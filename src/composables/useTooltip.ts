import { inject, ref, type Ref } from "vue";

export function useTooltip() {
  const tooltipsEnabled = inject<Ref<boolean>>("tooltipsEnabled", ref(true));

  function tooltip(value: string) {
    return { value, disabled: !tooltipsEnabled.value };
  }

  return {
    tooltipsEnabled,
    tooltip,
  };
}
