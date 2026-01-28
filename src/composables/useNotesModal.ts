import { ref } from "vue";

export function useNotesModal() {
  const notesModalOpen = ref(false);
  const notesModalTitle = ref("");
  const notesModalContent = ref("");

  function openNotesModal(name: string, content?: string) {
    notesModalTitle.value = name || "Unnamed";
    notesModalContent.value = content || "";
    notesModalOpen.value = true;
  }

  function closeNotesModal() {
    notesModalOpen.value = false;
  }

  return {
    notesModalOpen,
    notesModalTitle,
    notesModalContent,
    openNotesModal,
    closeNotesModal,
  };
}
