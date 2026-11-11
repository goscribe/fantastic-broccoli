import Link from "next/link";

const SCREENS: [string, string][] = [
  ["Learn (self-directed)", "/design/learn"],
  ["Question · multiple choice", "/design/question?type=mcq"],
  ["Question · multiple choice · wrong, with chat", "/design/question?type=mcq&state=fb&chat=1"],
  ["Question · panel collapsed", "/design/question?type=mcq&panel=closed"],
  ["Question · text (6 marks)", "/design/question?type=text"],
  ["Question · text · marked", "/design/question?type=text&state=fb"],
  ["Question · sketch", "/design/question?type=sketch"],
  ["Question · sketch · marked", "/design/question?type=sketch&state=fb"],
  ["Lesson step complete (mobile)", "/design/complete"],
];

export default function DesignIndex() {
  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-bold">Redesign preview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Static screens with mock data. Not linked from the app.</p>
      <ul className="mt-6 flex flex-col gap-2">{SCREENS.map(([l, h]) => <li key={h}><Link href={h} className="block rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted">{l}</Link></li>)}</ul>
    </div>
  );
}
