import { Avatar } from "@/components/ui/Avatar";
import type { PublicUserDto } from "@/lib/types";

/** Аватар + имя + @username + подпись «исполнитель VOXY». */
export function ProfileIdentity({ user }: { user: PublicUserDto }) {
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();

  return (
    <div className="mt-5 flex items-center gap-4">
      <Avatar
        firstName={user.firstName}
        lastName={user.lastName}
        username={user.username}
        photoUrl={user.photoUrl}
        size={76}
      />

      <div className="min-w-0">
        <p className="truncate text-[22px] leading-tight font-extrabold tracking-[-0.02em]">{fullName}</p>
        {user.username ? <p className="mt-1 truncate text-[14px] text-muted">@{user.username}</p> : null}
        <span className="mt-2 inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-bold text-primary">
          исполнитель VOXY
        </span>
      </div>
    </div>
  );
}
