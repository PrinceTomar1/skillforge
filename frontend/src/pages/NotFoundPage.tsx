import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Button } from "../components/ui";

export default function NotFoundPage() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 max-w-sm text-slate-500">The page you're looking for doesn't exist or may have moved.</p>
        <Link to="/">
          <Button className="mt-6">Back to home</Button>
        </Link>
      </div>
    </AppLayout>
  );
}
