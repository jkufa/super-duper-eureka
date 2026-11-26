<script lang="ts">
  import { IS_GPUIX, blur } from 'gpuix-svelte';
  import { key_of } from 'gpuix-svelte-ui/keys';
  import { test_id } from 'gpuix-svelte-ui/shared';
  import { theme } from 'gpuix-svelte-ui/theme';
  import { formatNumber, parseNumber } from './number-field';

  // Spike Q3: one numeric field for both targets. Typing edits a draft string only. Blur and Enter
  // commit the parsed number, Up and Down step it and commit, and an empty field commits `fallback`.
  // GPUI's input and the DOM's report through different events, so the handlers are spread per
  // renderer, the way the kit's TextField does it.
  let {
    value,
    oncommit,
    fallback,
    step = 1,
    label,
    testid,
    trace
  }: {
    /** The committed value. */
    value: number;
    oncommit: (value: number) => void;
    fallback: number;
    step?: number;
    label: string;
    /** The wrapper's test id; the input gets `<testid>-input`. */
    testid: string;
    trace?: (event: string, detail?: unknown) => void;
  } = $props();

  // Follows the committed value, and holds what the user typed in between.
  let draft = $derived(formatNumber(value));

  function commit(source: string) {
    const next = parseNumber(draft, fallback, value);
    trace?.('numberfield:commit', { source, draft, next });
    draft = formatNumber(next);
    oncommit(next);
  }

  function stepBy(direction: 1 | -1) {
    const next = parseNumber(draft, fallback, value) + direction * step;
    trace?.('numberfield:step', { direction, draft, next });
    draft = formatNumber(next);
    oncommit(Math.round(next * 1e6) / 1e6);
  }

  type FieldEvent = {
    type?: string;
    key?: string | null;
    value?: unknown;
    target?: unknown;
    preventDefault(): void;
  };

  // GPUI's `change` carries the text as `e.value`; the DOM's `input` carries the element.
  const textOf = (e: FieldEvent) =>
    typeof e.value === 'string'
      ? e.value
      : String((e.target as { value?: string } | null)?.value ?? '');

  function onchange(e: FieldEvent) {
    draft = textOf(e);
    trace?.('numberfield:draft', { type: e.type, draft });
  }

  // GPUI keeps a text field focused when the pointer goes down on something that takes no focus
  // (plain text, a card), where a browser would blur it. So on GPUI a press outside the field hands
  // focus back to the window, which fires the field's `blur` and commits. GPUI's input does not
  // report `mousedownoutside` itself, so the wrapper listens.
  let focused = false;

  function onfocus() {
    focused = true;
  }

  function onblur(e: FieldEvent) {
    focused = false;
    trace?.('numberfield:blur', { type: e.type });
    commit('blur');
  }

  function onmousedownoutside(e: FieldEvent) {
    if (focused) {
      trace?.('numberfield:mousedownoutside', { type: e.type });
      blur();
    }
  }

  function onkeydown(e: FieldEvent) {
    const key = key_of(e);
    trace?.('numberfield:keydown', { key });
    if (key === 'up' || key === 'down') {
      e.preventDefault();
      stepBy(key === 'up' ? 1 : -1);
    } else if (key === 'enter' && !IS_GPUIX) {
      commit('enter');
    }
  }

  const handlers = $derived.by(() => {
    if (IS_GPUIX) {
      // GPUI's input draws its text from a theme object, not CSS, as in the kit's TextField.
      const p = theme.palette;
      return {
        theme: {
          appearance: p.appearance,
          bg: 'transparent',
          border: 'transparent',
          text: p.ink,
          textMuted: p.muted,
          accent: p.accent,
          caret: p.accent
        },
        onchange,
        // GPUI's input reports Enter as `submit`.
        onsubmit: () => commit('enter'),
        onfocus,
        onblur,
        onkeydown
      };
    }
    return {
      oninput: onchange,
      onblur,
      onkeydown
    };
  });

  const wrapper = IS_GPUIX ? { onmousedownoutside } : {};
</script>

<div class="field" {...wrapper} {...test_id(testid)}>
  <div class="label">{label}</div>
  <input
    class="input"
    aria-label={label}
    value={draft}
    {...handlers}
    {...test_id(`${testid}-input`)}
  />
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    line-height: 18px;
    color: var(--ui-ink);
  }
  .input {
    display: flex;
    align-items: center;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    border-width: 1px;
    border-style: solid;
    border-color: var(--ui-border-strong);
    font-size: 14px;
    line-height: 20px;
    box-sizing: border-box;
    background-color: var(--ui-panel);
    color: var(--ui-ink);
  }
</style>
