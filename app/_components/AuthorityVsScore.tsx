// The mechanic banner. Visible on every level so the judge can see it.
// "AUTHORITY ≠ SCORE — Leveling up gives you more capability. It does not give you more authority."

export function AuthorityVsScore() {
  return (
    <div className="auth-vs-score" role="note" aria-label="Game mechanic note">
      <span className="avs-kicker">MECHANIC</span>
      <span className="avs-main">
        <strong>AUTHORITY ≠ SCORE.</strong> Leveling up gives you more <em>capability</em> to
        experiment with. It does not give you more <em>authority</em>.
      </span>
    </div>
  );
}
