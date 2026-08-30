"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOUNDRY_CATALOG, rankFoundryCatalog, type FoundryCatalogEntry } from "../../../src/flagship/foundry-catalog";
import type { FoundryProfile } from "../../../src/flagship/foundry-profile";
import { useFoundrySession } from "../foundry-session";

function initialValues(entry: FoundryCatalogEntry, profile: FoundryProfile): Record<string, string> {
  return Object.fromEntries(entry.fields.map((field) => [field.key, field.key === "actor" ? profile.defaultActor : field.key === "amount" ? profile.serviceCreditCeiling : field.defaultValue]));
}

export default function FoundryCatalogPage() {
  const router = useRouter();
  const { tools, profile, updateProfile } = useFoundrySession();
  const [selected, setSelected] = useState<FoundryCatalogEntry>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [profileDraft, setProfileDraft] = useState(profile);
  const built = new Set(tools.map((tool) => tool.name));

  function openBrief(entry: FoundryCatalogEntry) {
    setSelected(entry);
    setValues(initialValues(entry, profile));
  }

  const orderedCatalog = rankFoundryCatalog(FOUNDRY_CATALOG, profile);

  function applyProfile() {
    updateProfile({
      companyName: profileDraft.companyName,
      focus: profileDraft.focus,
      brandVoice: profileDraft.brandVoice,
      campaignStyle: profileDraft.campaignStyle,
      campaignOffer: profileDraft.campaignOffer,
      defaultActor: profileDraft.defaultActor,
      serviceCreditCeiling: profileDraft.serviceCreditCeiling,
    });
  }

  function buildFromBrief() {
    if (!selected) return;
    if (selected.fields.some((field) => !values[field.key]?.trim())) return;
    router.push(`/foundry?request=${encodeURIComponent(selected.buildIntent(values))}`);
  }

  return <main className="foundry foundry-catalog-page">
    <header className="foundry-top"><Link href="/">XACT</Link><span>WEBMCP FOUNDRY</span><nav className="foundry-tabs" aria-label="Foundry pages"><Link href="/foundry">BOSS · BUILD A TOOL</Link><Link href="/foundry/catalog" aria-current="page">WHAT XACT CAN BUILD</Link></nav><strong>Approved recipes are not tools until Xact constructs and verifies them.</strong></header>
    <section className="foundry-catalog-hero"><p className="foundry-kicker">YOUR GOVERNED FOUNDRY PROFILE · V{profile.version}</p><h1>Set the boundaries. Build what fits.</h1><p>Your profile ranks the approved recipes and supplies explicit defaults for new briefs. It does not authorize construction, execution, delivery, or Commit.</p><Link className="foundry-new-conversation" href="/foundry">OPEN BOSS CHAT</Link></section>
    <section className="foundry-profile-panel"><div><span className="foundry-state">PROFILE CONTROLS · SESSION ONLY</span><h2>How should Foundry prepare work?</h2><p>These are explicit build preferences, not hidden model training. Company name, campaign voice, and style are applied only to draft preparation; delivery stays draft-only.</p></div><label className="foundry-label">Company name<input value={profileDraft.companyName} onChange={(event) => setProfileDraft((current) => ({ ...current, companyName: event.target.value }))} /></label><label className="foundry-label">Prioritize<select value={profileDraft.focus} onChange={(event) => setProfileDraft((current) => ({ ...current, focus: event.target.value as FoundryProfile["focus"] }))}><option value="CUSTOMER_OPERATIONS">Customer and operations</option><option value="CAMPAIGN_OPERATIONS">Campaigns and content</option></select></label><label className="foundry-label">Brand voice<input value={profileDraft.brandVoice} onChange={(event) => setProfileDraft((current) => ({ ...current, brandVoice: event.target.value }))} /></label><label className="foundry-label">Campaign style<input value={profileDraft.campaignStyle} onChange={(event) => setProfileDraft((current) => ({ ...current, campaignStyle: event.target.value }))} /></label><label className="foundry-label">Promotion offer<input value={profileDraft.campaignOffer} onChange={(event) => setProfileDraft((current) => ({ ...current, campaignOffer: event.target.value }))} /></label><label className="foundry-label">Default actor<input value={profileDraft.defaultActor} onChange={(event) => setProfileDraft((current) => ({ ...current, defaultActor: event.target.value }))} /></label><label className="foundry-label">Service-credit ceiling<input type="number" value={profileDraft.serviceCreditCeiling} onChange={(event) => setProfileDraft((current) => ({ ...current, serviceCreditCeiling: event.target.value }))} /></label><button className="foundry-build foundry-profile-apply" type="button" onClick={applyProfile}>APPLY PROFILE REVISION</button><p className="foundry-profile-lock">APPROVED AUDIENCE · Foundry mock customer directory<br />DELIVERY MODE · DRAFT ONLY<br />{tools.length} governed tool variant{tools.length === 1 ? "" : "s"} constructed in this session</p></section>
    <section className="foundry-catalog-grid" aria-label="Approved Foundry recipes">{orderedCatalog.map((entry) => {
      const onShelf = built.has(entry.id);
      return <article className="foundry-catalog-card" key={entry.id}>
        <div><span className={`foundry-catalog-kind is-${entry.kind.toLowerCase()}`}>{entry.kind.replaceAll("_", " ")}</span><span className="foundry-state">{onShelf ? "ON YOUR FOUNDRY SHELF" : "READY TO CONSTRUCT"}</span></div>
        <h2>{entry.title}</h2><p>{entry.description}</p>
        <dl><div><dt>Approved substrate</dt><dd>{entry.substrate}</dd></div><div><dt>Build brief</dt><dd>{entry.fields.length ? `${entry.fields.length} required bound${entry.fields.length > 1 ? "s" : ""}` : "No additional bounds"}</dd></div></dl>
        <button className="foundry-build" type="button" onClick={() => openBrief(entry)}>{onShelf ? "USE OR REVIEW TOOL" : "BUILD THIS TOOL"}</button>
      </article>;
    })}</section>
    {selected ? <section className="foundry-brief-popover" role="dialog" aria-modal="true" aria-labelledby="brief-title"><div className="foundry-brief-card"><button className="foundry-brief-close" type="button" onClick={() => setSelected(undefined)} aria-label="Close build brief">×</button><span className="foundry-state">BUILD BRIEF · {selected.kind.replaceAll("_", " ")}</span><h2 id="brief-title">{selected.title}</h2><p>{selected.description}</p>{selected.fields.length ? selected.fields.map((field) => <label className="foundry-label" key={field.key}>{field.label}<small>{field.hint}</small><input type={field.type ?? "text"} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /></label>) : <p className="foundry-brief-note">No additional build bounds are required. Xact will construct only the governed, read/draft-only recipe shown above.</p>}<button className="foundry-build" type="button" onClick={buildFromBrief} disabled={selected.fields.some((field) => !values[field.key]?.trim())}>{built.has(selected.id) ? "OPEN WITH BOSS" : "SEND BUILD BRIEF TO BOSS"}</button><p className="foundry-brief-note">The Boss—not this form—checks the request, constructs the tool, and records its real activity. Profile defaults are proposal inputs, never authority.</p></div></section> : null}
  </main>;
}
