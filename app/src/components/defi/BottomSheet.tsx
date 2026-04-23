"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-brand-ink/50"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-brand-beige"
            style={{ boxShadow: "0 -8px 40px rgba(153,69,255,0.12)" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0.5 sticky top-0 bg-brand-beige z-10">
              <div className="w-10 h-1 rounded-full bg-brand-border-dark" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-border flex items-center justify-center"
            >
              <X className="w-4 h-4 text-brand-muted" />
            </button>

            <div className="px-5 pb-10 pt-2">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
