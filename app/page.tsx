import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center space-y-8 p-8">
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50">
          PrintOps
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-md">
          AI-Powered Workspace Builder for Print Businesses
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/workspace"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Workspace
          </Link>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vertical Slice #1: Dynamic Workspace Rendering
          </p>
        </div>
      </div>
    </div>
  );
}
