<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";
  import backgroundDataURL from "$lib/data/truncated_backgrounds.dat?url";

  import ROM from "$lib/rom/ROM";
  import Engine from "$lib/engine";
  import BackgroundLayer from "$lib/rom/BackgroundLayer";
  import { DEFAULT_FPS as fps } from "$lib/constants";


  let { data }: PageProps = $props();
  const { layer1, layer2, aspectRatio, frameSkip } = $derived(data.config);

  let canvas: HTMLCanvasElement;
  let rom: ROM | null = $state(null);
  let engine: Engine | null = $state(null);

  $effect(() => {
    if (rom && engine) engine.layers[0] = new BackgroundLayer(rom, layer1);
  });
  $effect(() => {
    if (rom && engine) engine.layers[1] = new BackgroundLayer(rom, layer2);
  });

  onMount(async () => {
    const bgData = new Uint8Array(
      await (await fetch(backgroundDataURL)).arrayBuffer(),
    );
    rom = new ROM(bgData);

    let alpha = layer1 === 0 || layer2 === 0 ? 1.0 : 0.5;

    engine = new Engine(
      [new BackgroundLayer(rom, layer1), new BackgroundLayer(rom, layer2)],
      {
        fps,
        aspectRatio,
        frameSkip,
        alpha: [alpha, alpha],
        canvas,
      },
    );
    engine.animate();
  });
</script>

<canvas
  class="p-0 m-0 h-auto absolute top-1/2 left-1/2 -translate-1/2 backface-hidden main-canvas"
  bind:this={canvas}
></canvas>

<style>
  :global(html) {
    background-color: black;
  }

  .main-canvas {
    /* width: 99.2%; */
    width: 100%;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    image-rendering: -moz-crisp-edges;
    -webkit-backface-visibility: hidden;
  }
</style>
