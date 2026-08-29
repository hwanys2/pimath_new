import NotFoundActions from "@/components/NotFoundActions";

export default function NotFound() {
  return (
    <div className="quest-card mx-auto max-w-lg p-10 text-center">
      <p className="text-5xl" aria-hidden>
        🗺️
      </p>
      <h1 className="font-display mt-4 text-2xl">길을 잃었어요!</h1>
      <NotFoundActions />
    </div>
  );
}
