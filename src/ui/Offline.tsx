import "./Form.css";

/**
 * What to say when the online half is not configured.
 *
 * This used to be "put your Supabase keys in .env.local, see docs/SETUP.md" -
 * printed to *players*, on the live site. A player has no .env.local and no
 * repository; that sentence is a note to the developer that escaped into the
 * product, and seeing it on the deployed game is the symptom of a missing
 * build secret, not advice anyone can act on.
 *
 * So: players are told what they can do (nothing is broken, play offline),
 * and the fix-it line appears only in a dev build, where it is true.
 */
export default function Offline({ what }: { what: string }) {
  return (
    <p className="form-offline">
      아직 서버에 연결되지 않아서 {what} 없다. 혼자 하기는 그대로 된다.
      {import.meta.env.DEV && (
        <>
          <br />
          <br />
          <b>개발 메모:</b> <code>.env.local</code>에 <code>VITE_SUPABASE_URL</code>과{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>를 넣으면 켜진다. 배포본이라면 저장소
          Settings → Secrets → Actions에 같은 이름으로 넣고 다시 배포한다 —{" "}
          <code>docs/SETUP.md</code>
        </>
      )}
    </p>
  );
}
