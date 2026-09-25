import { avatarGradient, cn, initials } from "@/lib/utils";

/** Аватар: фото из Telegram, иначе инициалы на детерминированном градиенте. */
export function Avatar({
  firstName,
  lastName,
  username,
  photoUrl,
  size = 48,
  className,
  ring = false,
}: {
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const seed = username ?? `${firstName}${lastName ?? ""}`;
  const shared = cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-primary/40", className);

  if (photoUrl) {
    return (
      // Внешние URL из Telegram: обычный <img>, чтобы не настраивать domains для next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={shared}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center font-bold text-white", shared)}
      style={{ width: size, height: size, background: avatarGradient(seed), fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(firstName, lastName, username)}
    </div>
  );
}
