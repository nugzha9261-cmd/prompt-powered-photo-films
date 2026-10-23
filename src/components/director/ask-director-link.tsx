import { Link } from "@tanstack/react-router";

import directorMark from "@/assets/director-mark.png";

/** Shortcut from a prompt box to the AI Director chat. */
export function AskDirectorLink() {
  return (
    <Link
      to="/director"
      className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      <img src={directorMark} alt="" width={18} height={18} className="size-[18px]" />
      Not sure what to write? Ask the AI Director
    </Link>
  );
}
