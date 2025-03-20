<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";
  import backgroundDataURL from "$lib/data/truncated_backgrounds.dat?url";

  import ROM from "$lib/rom/ROM";
  import BackgroundLayer from "$lib/rom/BackgroundLayer";
  import Engine from "$lib/Engine";

  import { DEFAULT_FPS as fps } from "$lib/constants";

  let { data }: PageProps = $props();
  const { layer1, layer2, aspectRatio, frameSkip } = $derived(data.config);

  let container: HTMLDivElement;
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
        containerElement: container,
        // initialShader: "zfast-crt",
        initialShader: "none",
        renderScale: 4,
        preRenderFrames: 0,
      },
    );

    engine.animate();

    // return () => {
    //   if (engine) {
    //     engine.animate()(); // Call the cleanup function
    //   }
    // };
  });
</script>

<div class="crt-container" bind:this={container}></div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: black;
    width: 100%;
    height: 100%;
  }

  .crt-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
