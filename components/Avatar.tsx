import { initials } from "@/lib/avatar";

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "h-10 w-10 text-sm" : size === "lg" ? "h-28 w-28 text-3xl" : "h-16 w-16 text-lg";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${dim} rounded-2xl object-cover ring-1 ring-line`}
      />
    );
  }

  return (
    <div
      className={`${dim} grid place-items-center rounded-2xl bg-panel-2 font-display text-brass ring-1 ring-line`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
