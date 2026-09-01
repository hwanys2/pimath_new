import type { ForumStoredImage } from "@/lib/forum/types";

type Props = {
  images: ForumStoredImage[];
  size?: "sm" | "md";
};

export default function ForumImages({ images, size = "md" }: Props) {
  if (images.length === 0) return null;
  const box = size === "sm" ? "h-24 w-24" : "h-36 w-36 sm:h-44 sm:w-44";

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {images.map((image) => (
        <li key={image.path}>
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className={`block overflow-hidden rounded-xl border border-wood/10 bg-white ${box}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt="첨부 그림"
              className="h-full w-full object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
