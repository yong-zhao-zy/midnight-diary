"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useInspirationStore } from "@/store/inspiration-store";
import type { NoteRow } from "@/lib/note-service";
import { NoteListSkeleton } from "./NoteListSkeleton";
import { NoteEmptyState } from "./NoteEmptyState";
import { NoteItem } from "./NoteItem";
import { NoteEditorSheet } from "./NoteEditorSheet";

export function NoteListPanel() {
  const notes = useInspirationStore((s) => s.notes);
  const notesFetchedAt = useInspirationStore((s) => s.notesFetchedAt);
  const removeNote = useInspirationStore((s) => s.removeNote);

  const [editorOpen, setEditorOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<NoteRow | null>(null);

  const openEditorForNew = () => {
    setNoteToEdit(null);
    setEditorOpen(true);
  };

  const openEditorForEdit = (note: NoteRow) => {
    setNoteToEdit(note);
    setEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    return await removeNote(id);
  };

  // Loading state — prevent content flash
  if (notesFetchedAt === null) {
    return <NoteListSkeleton />;
  }

  // Empty state
  if (notes.length === 0) {
    return (
      <>
        <NoteEmptyState onManualAdd={openEditorForNew} />
        <NoteEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          noteToEdit={noteToEdit}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-20">
        {notes.map((note, index) => (
          <NoteItem
            key={note.id}
            note={note}
            index={index}
            onEdit={openEditorForEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* FAB for manual add */}
      <button
        onClick={openEditorForNew}
        className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
        aria-label="新增笔记"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <NoteEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        noteToEdit={noteToEdit}
      />
    </>
  );
}
