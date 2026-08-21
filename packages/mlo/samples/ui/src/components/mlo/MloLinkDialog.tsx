import type { MloObject } from '@zhengxs/mlo';
import React from 'react';
import { X } from 'lucide-react';

import { MloBadge } from './MloBadge.js';

export type MloLinkDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  links: number[];
  allItems: MloObject[];
  title: string;
};

export const MloLinkDialog: React.FC<MloLinkDialogProps> = ({
  isOpen,
  onClose,
  links,
  allItems,
  title,
}) => {
  if (!isOpen) return null;

  const linkedItems = allItems.filter(item => links.includes(item.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-950/5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-900">Linked Objects: {title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {linkedItems.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              No linked items found in current dataset.
            </div>
          ) : (
            <div className="space-y-3">
              {linkedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400">#{item.id}</span>
                    <span className="font-medium text-zinc-900">{item.name}</span>
                    <MloBadge variant="secondary">{item.type}</MloBadge>
                  </div>
                  {item.detached && (
                    <span className="text-xs font-medium text-red-600">Detached</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
