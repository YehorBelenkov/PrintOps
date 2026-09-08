import Link from 'next/link';
import { StickerStudio } from '@/components/sticker/StickerStudio';

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b bg-card">
        <div className="mx-auto max-w-[1600px] px-6 flex items-center h-16 gap-8">
          <span className="font-bold text-lg">Sticker Studio</span>
          <Link
            href="/workspace"
            className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
          >
            Back to workspace
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <StickerStudio />
      </main>
    </div>
  );
}
