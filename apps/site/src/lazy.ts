import { createSequence, type Sequence, type SequenceOptions } from './sequence';

/**
 * Un film qui ne garde ses images en mémoire que lorsque sa section approche de l'écran.
 * Sur ordinateur, un film entier décodé pèse près de 180 Mo : on n'en garde que ceux qui comptent.
 * Le canvas conserve la dernière image dessinée quand le film est libéré.
 */
export function lazySequence(o: SequenceOptions, section: HTMLElement, margin = '120%'): Sequence {
  let seq: Sequence | null = null;
  let last = 0;
  let readyFn: () => void = () => undefined;
  let loadedFn: () => void = () => undefined;
  const ready = new Promise<void>((r) => (readyFn = r));
  const loaded = new Promise<void>((r) => (loadedFn = r));
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !seq) {
      seq = createSequence(o);
      seq.set(last);
      void seq.ready.then(readyFn);
      void seq.loaded.then(loadedFn);
    } else if (!e.isIntersecting && seq) {
      seq.destroy();
      seq = null;
    }
  }, { rootMargin: `${margin} 0px ${margin} 0px` });
  io.observe(section);
  return {
    ready, loaded,
    set(p) { last = p; seq?.set(p); },
    resize() { seq?.resize(); },
    destroy() { io.disconnect(); seq?.destroy(); seq = null; },
  };
}
