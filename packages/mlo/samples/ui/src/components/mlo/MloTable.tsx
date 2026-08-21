import type { MloObject } from '@zhengxs/mlo';
import React, { useMemo, useState } from 'react';
import { Filter, ChevronRight, ChevronLeft } from 'lucide-react';

import { MloObjectRow } from './MloObjectRow.js';

export type MloTableProps = {
  data: MloObject[];

  pagination?: {
    page?: number;
    pageSize?: number;
  };

  onLink(links: number[], title: string): void;
  onLog(item: MloObject): void;
};

export const MloTable: React.FC<MloTableProps> = ({ data, pagination, onLink, onLog }) => {
  const [current, setCurrentPage] = useState<number>(pagination?.page || 1);
  const [pageSize] = useState<number>(pagination?.page || 10);

  const totalPages = Math.ceil(data.length / pageSize);

  const paginatedItems = useMemo(() => {
    return data.slice((current - 1) * pageSize, current * pageSize);
  }, [data, current, pageSize]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50/50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Name / Type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Links</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedItems.length > 0 ? (
              paginatedItems.map(item => (
                <MloObjectRow key={item.id} item={item} onLink={onLink} onLog={onLog} />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter size={32} className="text-zinc-300" />
                    <p>No objects found matching your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
        <p className="text-sm text-zinc-500">
          Showing <span className="font-medium text-zinc-900">{data.length}</span> results
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={pagination?.page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-zinc-900">
            Page {current} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={current === totalPages || totalPages === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
