import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-3xl">Not found</h1>
      <p className="text-fog">That page is not in this companion app.</p>
      <Link href="/" className="text-sky underline">
        Back to the library
      </Link>
    </div>
  );
}
