<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { ClientUser } from '$lib/client/session';
  import Sparkles from '$lib/components/Sparkles.svelte';
  import { renderMarkdown } from '$lib/client/markdown';
  import { errorMessage } from '$lib/client/http';

  interface ToolDescriptor { id: string; label: string; description: string; }
  interface Model {
    id: number; label: string;
    provider_name: string; provider_label: string; model_id: string;
    api_style?: 'chat' | 'responses';
    available_tools?: ToolDescriptor[];
  }
  interface UIAttachment { name: string; mime_type: string; data_url: string; size: number; }
  interface UISource { url: string; title: string; }
  interface UIMessage {
    id: string; role: 'user' | 'assistant'; content: string;
    pending?: boolean; stopped?: boolean;
    attachments?: UIAttachment[];
    sources?: UISource[];
  }

  const MAX_FILES = 5;
  const MAX_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

  let {
    user,
    conversationId,
    models,
    selectedModelId = $bindable<number | null>(),
    initialMessages,
    onConversationStart,
    onTitleChange,
    onMessageSent
  }: {
    user: ClientUser;
    conversationId: string | null;
    models: Model[];
    selectedModelId: number | null;
    initialMessages: UIMessage[];
    onConversationStart: (modelId: number) => Promise<string>;
    onTitleChange: (id: string, title: string, persist?: boolean) => void;
    onMessageSent: (id: string) => void;
  } = $props();

  // Rotating welcome aliases. Picked fresh whenever the user lands on an
  // empty thread (new chat). Plus their real nickname, weighted a little
  // higher than any single alias.
  const FUN_NAMES = [
    'mogger', 'chatmaxxer', 'tokenmaxxer', 'slopmaxxer', 'promptmaxxer',
    'giga-mogger', 'llm-mogger', 'prompt-mogger', 'ragemaxxer', 'vibemaxxer',
    'copemaxxer'
  ];
  function pickGreetName(nickname: string) {
    const safe = nickname.trim().slice(0, 24);
    // ~30% chance to use the real nickname (if it looks reasonable).
    if (safe && Math.random() < 0.30) return safe;
    return FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
  }
  let greetName = $state('');
  onMount(() => { greetName = pickGreetName(user.nickname); });

  let messages = $state<UIMessage[]>([]);
  let input = $state('');
  let sending = $state(false);
  let scrollEl: HTMLDivElement | undefined = $state();
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let fileInputEl: HTMLInputElement | undefined = $state();
  let toolsOpen = $state(false);
  let enabledTools = $state<string[]>([]);
  let pendingAttachments = $state<UIAttachment[]>([]);
  let attachErr = $state('');
  let abortCtl: AbortController | null = null;

  const selectedModelTools = $derived(
    models.find((m) => m.id === selectedModelId)?.available_tools ?? []
  );

  // Drop any enabled tools the (newly) selected model can't offer.
  $effect(() => {
    const ids = new Set(selectedModelTools.map((t) => t.id));
    untrack(() => {
      const filtered = enabledTools.filter((t) => ids.has(t));
      if (filtered.length !== enabledTools.length) enabledTools = filtered;
    });
  });

  function toggleTool(id: string) {
    enabledTools = enabledTools.includes(id)
      ? enabledTools.filter((t) => t !== id)
      : [...enabledTools, id];
  }

  // Reset messages when the parent swaps the conversation. We read
  // initialMessages here but mutate `messages`, which would re-trigger this
  // effect — `untrack` keeps the loop from forming.
  $effect(() => {
    const incoming = initialMessages;
    untrack(() => {
      // Abort any stream still running for the thread we're leaving, so it
      // stops writing into a now-detached message and unlocks the composer.
      abortCtl?.abort();
      messages = [...incoming];
    });
  });

  // Is the viewport already parked at (or very near) the bottom? Used to decide
  // whether streamed tokens should keep the view pinned. If the user has
  // scrolled up to read earlier content, we leave them be.
  function isNearBottom(): boolean {
    if (!scrollEl) return true;
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 120;
  }

  async function scrollDown(behavior: ScrollBehavior = 'smooth') {
    await tick();
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior });
  }

  function autosize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 320) + 'px';
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  async function onPick(e: Event) {
    attachErr = '';
    const fl = (e.currentTarget as HTMLInputElement).files;
    if (!fl) return;
    for (const f of Array.from(fl)) {
      if (pendingAttachments.length >= MAX_FILES) {
        attachErr = `max ${MAX_FILES} files per message`;
        break;
      }
      if (f.size > MAX_BYTES) {
        attachErr = `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)} MB — limit is 5 MB`;
        continue;
      }
      if (!ACCEPTED_TYPES.includes(f.type)) {
        attachErr = `${f.name}: only PNG, JPEG, GIF or WebP images`;
        continue;
      }
      try {
        const data_url = await fileToDataUrl(f);
        pendingAttachments = [...pendingAttachments, {
          name: f.name, mime_type: f.type, data_url, size: f.size
        }];
      } catch {
        attachErr = `couldn't read ${f.name}`;
      }
    }
    (e.currentTarget as HTMLInputElement).value = '';
  }

  function removeAttachment(i: number) {
    pendingAttachments = pendingAttachments.filter((_, idx) => idx !== i);
  }

  async function send() {
    const content = input.trim();
    if ((!content && pendingAttachments.length === 0) || sending || !selectedModelId) return;

    sending = true;
    const attachmentsToSend = pendingAttachments;
    const toolsToSend = [...enabledTools];
    input = '';
    pendingAttachments = [];
    attachErr = '';
    await tick();
    autosize();

    let cid = conversationId;
    if (!cid) {
      try {
        cid = await onConversationStart(selectedModelId);
      } catch {
        sending = false;
        messages = [...messages, {
          id: crypto.randomUUID(), role: 'assistant',
          content: 'Could not start a conversation.'
        }];
        return;
      }
    }

    const userMsg: UIMessage = {
      id: crypto.randomUUID(), role: 'user', content,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
    };
    messages = [...messages, userMsg, {
      id: crypto.randomUUID(), role: 'assistant', content: '', pending: true
    }];
    // Mutate the $state proxy, not the raw literal: writes to the raw object
    // bypass Svelte's deep reactivity and streamed chunks would never render.
    const assistantMsg = messages[messages.length - 1];
    scrollDown();

    abortCtl = new AbortController();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abortCtl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId: cid, content,
          attachments: attachmentsToSend,
          enabledTools: toolsToSend
        })
      });
      if (!res.ok || !res.body) {
        // Nothing was saved server-side: drop the optimistic user bubble and
        // hand the draft back so it can be resent.
        assistantMsg.content = `⚠ ${await errorMessage(res)}`;
        assistantMsg.pending = false;
        messages = messages.filter((m) => m.id !== userMsg.id);
        input = content;
        pendingAttachments = attachmentsToSend;
        await tick();
        autosize();
        return;
      }
      onMessageSent(cid);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        // Check stickiness *before* the DOM grows from this chunk.
        const stick = isNearBottom();
        buf += decoder.decode(value, { stream: true });
        assistantMsg.content = buf;
        if (stick) scrollDown('auto');
      }
      assistantMsg.pending = false;

      // Sources (web search) are persisted server-side in onFinish, not in the
      // text stream. If a source-producing tool ran, pull them in after the fact.
      if (toolsToSend.includes('web_search')) {
        try {
          const r = await fetch(`/api/conversations/${cid}`);
          if (r.ok) {
            const data = await r.json();
            const last = [...data.messages].reverse()
              .find((m: { role: string }) => m.role === 'assistant');
            if (last?.sources?.length) {
              assistantMsg.sources = last.sources;
            }
          }
        } catch { /* sources are best-effort */ }
      }

      // First exchange → name the chat. Show a first-line placeholder instantly
      // (local only), then ask the server's titler model for a better name.
      // The /autotitle endpoint persists the result (with its own fallback), so
      // we only update local state here to avoid a write race.
      if (messages.filter((m) => m.role === 'assistant' && !m.pending).length === 1) {
        const placeholder = content.split('\n')[0].slice(0, 80) || 'New conversation';
        onTitleChange(cid, placeholder, false);
        fetch(`/api/conversations/${cid}/autotitle`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.title) onTitleChange(cid!, d.title, false); })
          .catch(() => {});
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User pressed stop. The server persists the partial (with a
        // "(stopped)" marker) on its side, so we only update local UI here.
        assistantMsg.pending = false;
        assistantMsg.stopped = true;
      } else {
        assistantMsg.content = '⚠ network error';
        assistantMsg.pending = false;
      }
    } finally {
      abortCtl = null;
      sending = false;
    }
  }

  function stop() {
    abortCtl?.abort();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const selectedModel = $derived(models.find((m) => m.id === selectedModelId));
</script>

<section class="chat">
  {#if messages.length > 0}
    <!-- Active thread: a pinned backdrop (doesn't scroll with the messages),
         edge-weighted and faded through the centre so the reading column stays
         legible while the margins keep their sparkle. -->
    <Sparkles count={80} fadeCenter />
  {/if}
  <div class="scroll" bind:this={scrollEl}>
    {#if messages.length === 0}
      <!-- New chat: dense, uniform sparkles filling the scroll area so they
           aren't clipped to a small box behind the heading. pointer-events:none
           on the layer keeps clicks reaching the composer / sidebar untouched. -->
      <Sparkles count={70} />
    {/if}
    <div class="thread">
      {#if messages.length === 0}
        <div class="welcome">
          <h1 class="italic">What's on your mind{greetName ? `, ${greetName}` : ''}?</h1>
          <p class="muted">Pick a model below and write. <code>Enter</code> sends, <code>Shift+Enter</code> for newlines.</p>
        </div>
      {/if}
      {#each messages as m (m.id)}
        <article class="msg" class:user={m.role === 'user'} class:assistant={m.role === 'assistant'}>
          <div class="role small italic muted">
            {m.role === 'user' ? user.nickname : 'assistant'}
            {#if m.stopped}<span class="small">· stopped</span>{/if}
          </div>
          {#if m.role === 'assistant' && m.pending && !m.content}
            <div class="thinking" aria-label="thinking"><span class="sparks"></span></div>
          {:else}
            {#if m.attachments && m.attachments.length > 0}
              <div class="msg-thumbs">
                {#each m.attachments as a}
                  <img class="msg-thumb" src={a.data_url} alt={a.name} title={a.name} />
                {/each}
              </div>
            {/if}
            {#if m.content}
              {#if m.role === 'assistant'}
                <div class="body prose">{@html renderMarkdown(m.content)}</div>
              {:else}
                <div class="body">{m.content}</div>
              {/if}
            {/if}
            {#if m.role === 'assistant' && m.sources && m.sources.length > 0}
              <div class="sources">
                <div class="small italic muted">sources</div>
                <ol>
                  {#each m.sources as s}
                    <li><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a></li>
                  {/each}
                </ol>
              </div>
            {/if}
          {/if}
        </article>
      {/each}
    </div>
  </div>

  <footer class="composer-wrap">
    <div class="composer lift">
      {#if pendingAttachments.length > 0}
        <div class="thumbs">
          {#each pendingAttachments as a, i}
            <div class="thumb" title={`${a.name} · ${(a.size / 1024).toFixed(0)} KB`}>
              <img src={a.data_url} alt={a.name} />
              <button type="button" class="thumb-x" onclick={() => removeAttachment(i)} aria-label="remove">×</button>
            </div>
          {/each}
        </div>
      {/if}
      {#if attachErr}
        <div class="small" style="color: var(--danger); padding: 0 0.4rem">{attachErr}</div>
      {/if}
      <textarea
        bind:this={textareaEl}
        bind:value={input}
        oninput={autosize}
        onkeydown={onKeydown}
        placeholder={selectedModelId ? 'write something…' : 'no models — visit /admin to configure'}
        disabled={!selectedModelId || sending}
        rows="1"
      ></textarea>
      <input
        type="file"
        bind:this={fileInputEl}
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        hidden
        onchange={onPick}
      />

      <div class="toolbar">
        <div class="row" style="gap: 0.4rem">
          <label class="picker" title="model">
            <span class="picker-label small italic muted">model</span>
            <select bind:value={selectedModelId} disabled={!!conversationId || sending}>
              {#each models as m}
                <option value={m.id}>{m.provider_label} · {m.label}</option>
              {/each}
            </select>
          </label>

          <div class="picker tools-wrap" style="position: relative;">
            <button
              type="button"
              class="ghost small tools-toggle"
              class:armed={enabledTools.length > 0}
              onclick={() => (toolsOpen = !toolsOpen)}
              disabled={selectedModelTools.length === 0}
              aria-expanded={toolsOpen}
              title={selectedModelTools.length === 0
                ? 'this model has no tools (needs a Responses-API model)'
                : 'tools'}
            >
              tools{enabledTools.length > 0 ? ` (${enabledTools.length})` : ''} <span class="caret">▾</span>
            </button>
            {#if toolsOpen && selectedModelTools.length > 0}
              <div class="tools-pop card">
                {#each selectedModelTools as t (t.id)}
                  <label class="tool-row">
                    <input
                      type="checkbox"
                      checked={enabledTools.includes(t.id)}
                      onchange={() => toggleTool(t.id)}
                    />
                    <span>
                      <span class="tool-label">{t.label}</span>
                      <span class="small muted block">{t.description}</span>
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>

          <button
            type="button"
            class="ghost small attach"
            title="attach images (max 5 × 5 MB)"
            onclick={() => fileInputEl?.click()}
            disabled={sending || pendingAttachments.length >= MAX_FILES}
          >📎</button>
        </div>

        <div class="row" style="gap: 0.6rem; align-items: center">
          {#if selectedModel}
            <span class="small muted italic">{selectedModel.provider_name}/{selectedModel.model_id}</span>
          {/if}
          {#if sending}
            <button class="stop" onclick={stop} title="stop generation">■ stop</button>
          {:else}
            <button
              class="navy"
              onclick={send}
              disabled={(!input.trim() && pendingAttachments.length === 0) || !selectedModelId}
            >send</button>
          {/if}
        </div>
      </div>
    </div>
  </footer>
</section>

<style>
  .chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100vh;
    min-width: 0;
    /* Anchor the pinned active-thread sparkle backdrop. */
    position: relative;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1.5rem 0.6rem;
    /* Positioning context for the empty-state sparkle layer so it can fill
       the whole reading area, not the tiny welcome heading. Also lifts the
       thread above the pinned active-thread backdrop (which is transparent, so
       the sparkles still show through). */
    position: relative;
    isolation: isolate;
    z-index: 1;
  }
  .scroll > :global(.thread) { position: relative; z-index: 2; }
  .thread {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
    padding-bottom: 1rem;
  }
  .welcome {
    text-align: center;
    padding: 4rem 1rem 2rem;
  }
  .msg .role { margin-bottom: 0.25rem; }
  .msg.user .body {
    background: var(--user-bubble);
    border: 1px solid var(--rule);
    padding: 0.6rem 0.9rem;
    border-radius: var(--radius-soft);
    display: inline-block;
    max-width: 100%;
    white-space: pre-wrap;
    box-shadow: var(--shadow-navy-soft);
  }
  .msg.assistant .body {
    line-height: 1.65;
  }
  /* Sanitized-HTML rendering for assistant messages. Tight margins so the
     thread doesn't feel like a textbook. Markdown semantics, paper aesthetic. */
  .prose :global(p) { margin: 0.4em 0; }
  .prose :global(p:first-child) { margin-top: 0; }
  .prose :global(p:last-child)  { margin-bottom: 0; }
  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3),
  .prose :global(h4) {
    font-family: var(--serif);
    font-weight: normal;
    margin: 0.9em 0 0.3em;
    line-height: 1.25;
  }
  .prose :global(h1) { font-size: 1.6rem; font-style: italic; }
  .prose :global(h2) { font-size: 1.35rem; }
  .prose :global(h3) { font-size: 1.15rem; }
  .prose :global(h4) { font-size: 1rem; font-style: italic; }
  .prose :global(ul),
  .prose :global(ol) { margin: 0.4em 0; padding-left: 1.4em; }
  .prose :global(li) { margin: 0.18em 0; }
  .prose :global(li > p) { margin: 0.2em 0; }
  .prose :global(blockquote) {
    margin: 0.6em 0;
    padding: 0.1em 0.9em;
    border-left: 3px solid var(--rule);
    color: var(--ink-soft);
    font-style: italic;
  }
  .prose :global(hr) {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 1em 0;
  }
  .prose :global(a) {
    color: var(--accent);
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .prose :global(code) {
    font-family: var(--mono);
    font-size: 0.9em;
    background: rgba(42, 36, 25, 0.08);
    padding: 0.05em 0.35em;
    border-radius: 2px;
  }
  .prose :global(pre) {
    background: rgba(28, 42, 68, 0.06);
    border: 1px solid var(--rule);
    border-radius: var(--radius-soft);
    padding: 0.7em 0.9em;
    overflow-x: auto;
    margin: 0.55em 0;
    box-shadow: var(--shadow-navy-soft);
  }
  .prose :global(pre code) {
    background: transparent;
    padding: 0;
    font-size: 0.92em;
    line-height: 1.5;
  }
  .prose :global(table) {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    margin: 0.6em 0;
  }
  .prose :global(th),
  .prose :global(td) {
    border: 1px solid var(--rule);
    padding: 0.35em 0.6em;
    text-align: left;
  }
  .prose :global(th) {
    font-style: italic;
    font-weight: normal;
    background: rgba(44, 62, 94, 0.06);
  }
  .prose :global(img) {
    max-width: 100%;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
  }

  .composer-wrap {
    padding: 0.8rem 1.5rem 1.2rem;
    background: transparent;
    /* Above the pinned active-thread sparkle backdrop. */
    position: relative;
    z-index: 1;
  }
  .composer {
    max-width: 880px;
    margin: 0 auto;
    padding: 0.9rem 1rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .composer textarea {
    resize: none;          /* auto-grow handles it */
    overflow-y: auto;
    border: none;
    background: transparent;
    padding: 0.35rem 0.4rem;
    font-size: 1.05rem;
    line-height: 1.5;
    min-height: 1.6rem;
    max-height: 320px;
    box-shadow: none;
  }
  .composer textarea:focus { background: transparent; }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    border-top: 1px dashed var(--rule);
    padding-top: 0.5rem;
  }
  .picker { display: inline-flex; align-items: center; gap: 0.4rem; }
  .picker-label { padding-left: 0.2rem; }
  .picker select {
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    padding: 0.25em 0.4em;
    cursor: pointer;
  }
  .picker select:hover { border-color: var(--rule); }
  .picker select:focus { border-color: var(--navy); }
  .tools-toggle .caret { font-size: 0.8em; }
  .tools-toggle.armed {
    color: var(--accent);
    border-color: var(--rule);
    background: rgba(201, 168, 106, 0.16);
  }
  .tools-pop {
    position: absolute;
    bottom: calc(100% + 0.4rem);
    left: 0;
    width: 300px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tool-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    cursor: pointer;
  }
  .tool-row input { margin-top: 0.25rem; }
  .tool-label { font-style: italic; }
  .block { display: block; }

  .sources {
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--rule);
  }
  .sources ol {
    margin: 0.3rem 0 0;
    padding-left: 1.3rem;
  }
  .sources li { margin: 0.15rem 0; }
  .sources a { word-break: break-word; }
  .attach {
    font-size: 1.1rem;
    padding: 0.25em 0.55em;
  }

  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.2rem 0.2rem 0.4rem;
  }
  .thumb {
    position: relative;
    width: 56px;
    height: 56px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-navy-soft);
    background: var(--paper);
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-x {
    position: absolute;
    top: -6px; right: -6px;
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 1px solid var(--rule);
    background: var(--paper);
    line-height: 1;
    padding: 0;
    font-size: 0.9rem;
    box-shadow: var(--shadow-navy-soft);
    cursor: pointer;
  }
  .thumb-x:hover { background: var(--danger); color: var(--paper); border-color: var(--danger); }

  .msg-thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }
  .msg-thumb {
    max-width: 240px;
    max-height: 240px;
    border: 1px solid var(--rule);
    border-radius: var(--radius-soft);
    box-shadow: var(--shadow-navy-soft);
    background: var(--paper);
  }
</style>
