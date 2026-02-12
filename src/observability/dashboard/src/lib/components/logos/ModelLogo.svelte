<script lang="ts">
  import { Bot } from "@lucide/svelte"
  import Claude from "./Claude.svelte"
  import Gemini from "./Gemini.svelte"
  import OpenAI from "./OpenAI.svelte"
  import { getModelProviderIcon } from "./modelLogo"
  import Grok from "./Grok.svelte"

  type Props = {
    provider?: string
    modelId?: string
    size?: number
  }

  let { provider, modelId, size = 16 }: Props = $props()

  const providerIcon = $derived(getModelProviderIcon(provider, modelId))
</script>

{#if providerIcon === "anthropic"}
  <Claude {size} />
{:else if providerIcon === "google"}
  <Gemini {size} />
{:else if providerIcon === "openai"}
  <OpenAI {size} />
{:else if providerIcon === "grok"}
  <Grok {size} />
{:else}
  <Bot {size} />
{/if}
