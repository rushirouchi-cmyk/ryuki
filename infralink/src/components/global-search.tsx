'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** グローバル検索 (§47)。候補者名 / 企業名 / 求人 / スキル / 資格を横断する。 */
export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <form
      className="flex w-full max-w-xl items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="候補者名 / 企業名 / 求人 / スキル / 資格 を検索"
        className="w-full rounded border border-[var(--border)] px-2.5 py-1 text-xs"
        aria-label="グローバル検索"
      />
      <button className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]">
        検索
      </button>
    </form>
  );
}
