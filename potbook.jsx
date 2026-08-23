import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================================================
   POTBOOK — Pembukuan meja poker, tanpa selisih
   Supabase project: Poker Ledger (diczhxkjcsmjsiowygjd)
   ============================================================ */

const SUPABASE_URL = "https://diczhxkjcsmjsiowygjd.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpY3poeGtqY3NtanNpb3d5Z2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODA3MzEsImV4cCI6MjEwMzA1NjczMX0.8wyeeHnkYsYgLqZ46iT5NEtHGNOLCzRiu_JoAZzmp3c";

/* ---------- fetch-based Supabase client (tanpa CDN) ---------- */
const rest = async (path, opts = {}) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
};
const sbSelect = (t, q = "") => rest(t + (q ? "?" + q : ""));
const sbInsert = (t, rows) =>
  rest(t, { method: "POST", body: JSON.stringify(rows) });

/* ---------- denominasi chip ---------- */
const DENOMS = [
  { value: 1, color: "#F1F5F9", ink: "#0B1220", label: "Putih" },
  { value: 5, color: "#EF4444", ink: "#FFFFFF", label: "Merah" },
  { value: 10, color: "#3B82F6", ink: "#FFFFFF", label: "Biru" },
  { value: 20, color: "#FACC15", ink: "#3B2A00", label: "Kuning" },
  { value: 50, color: "#22C55E", ink: "#04240F", label: "Hijau" },
  { value: 100, color: "#18181B", ink: "#F5F5F5", label: "Hitam" },
  { value: 500, color: "#A855F7", ink: "#FFFFFF", label: "Ungu" },
];

const HANDS = [
  { rank: 1, en: "Royal Flush", id: "Royal Flush", cards: ["A♠", "K♠", "Q♠", "J♠", "10♠"], desc: "A-K-Q-J-10 satu lambang. Tidak terkalahkan.", odds: "1 : 649.740" },
  { rank: 2, en: "Straight Flush", id: "Straight Flush", cards: ["9♥", "8♥", "7♥", "6♥", "5♥"], desc: "Lima kartu berurutan, lambang sama.", odds: "1 : 72.193" },
  { rank: 3, en: "Four of a Kind", id: "Empat Sekawan", cards: ["Q♠", "Q♥", "Q♦", "Q♣", "7♠"], desc: "Empat kartu bernilai sama. Kartu kelima jadi kicker.", odds: "1 : 4.164" },
  { rank: 4, en: "Full House", id: "Full House", cards: ["J♠", "J♥", "J♦", "4♣", "4♠"], desc: "Tiga sekawan plus satu pasang. Tiga sekawannya dinilai lebih dulu.", odds: "1 : 693" },
  { rank: 5, en: "Flush", id: "Flush", cards: ["K♦", "J♦", "8♦", "6♦", "3♦"], desc: "Lima kartu selambang, tidak berurutan. Kartu tertinggi menentukan.", odds: "1 : 508" },
  { rank: 6, en: "Straight", id: "Straight", cards: ["10♠", "9♦", "8♥", "7♣", "6♠"], desc: "Lima kartu berurutan, lambang campur. As bisa tinggi atau rendah.", odds: "1 : 254" },
  { rank: 7, en: "Three of a Kind", id: "Tiga Sekawan", cards: ["8♠", "8♥", "8♦", "K♣", "4♠"], desc: "Tiga kartu bernilai sama, dua sisanya tidak berpasangan.", odds: "1 : 46" },
  { rank: 8, en: "Two Pair", id: "Dua Pasang", cards: ["A♠", "A♥", "9♦", "9♣", "5♠"], desc: "Dua pasang berbeda. Pasangan tertinggi dinilai lebih dulu.", odds: "1 : 20" },
  { rank: 9, en: "One Pair", id: "Satu Pasang", cards: ["10♠", "10♥", "K♦", "6♣", "2♠"], desc: "Dua kartu bernilai sama, tiga sisanya berbeda.", odds: "1 : 1,37" },
  { rank: 10, en: "High Card", id: "Kartu Tertinggi", cards: ["A♠", "J♥", "8♦", "5♣", "2♠"], desc: "Tidak ada kombinasi. Kartu tertinggi yang bicara.", odds: "1 : 1" },
];

/* ---------- helpers ---------- */
const uid = () =>
  "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const rp = (n) =>
  "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID") ;

const signed = (n) => (n < 0 ? "−" : n > 0 ? "+" : "") + rp(n);

const num = (n) => Math.round(n).toLocaleString("id-ID");

const breakdownTotal = (bd) =>
  DENOMS.reduce((s, d) => s + (Number(bd[d.value]) || 0) * d.value, 0);

/* greedy: jumlah transfer minimum, maksimal n-1 */
function minTransfers(nets) {
  const debt = nets.filter((n) => n.net < -0.5).map((n) => ({ id: n.id, amt: -n.net }));
  const cred = nets.filter((n) => n.net > 0.5).map((n) => ({ id: n.id, amt: n.net }));
  debt.sort((a, b) => b.amt - a.amt);
  cred.sort((a, b) => b.amt - a.amt);
  const out = [];
  let i = 0;
  let j = 0;
  let guard = 0;
  while (i < debt.length && j < cred.length && guard < 200) {
    guard += 1;
    const pay = Math.min(debt[i].amt, cred[j].amt);
    if (pay > 0.5) out.push({ from: debt[i].id, to: cred[j].id, amount: Math.round(pay) });
    debt[i].amt -= pay;
    cred[j].amt -= pay;
    if (debt[i].amt <= 0.5) i += 1;
    if (cred[j].amt <= 0.5) j += 1;
  }
  return out;
}

/* semua lewat satu kasir */
function bankerTransfers(nets, bankerId) {
  const out = [];
  nets.forEach((n) => {
    if (n.id === bankerId) return;
    if (n.net < -0.5) out.push({ from: n.id, to: bankerId, amount: Math.round(-n.net) });
    else if (n.net > 0.5) out.push({ from: bankerId, to: n.id, amount: Math.round(n.net) });
  });
  return out;
}

/* ---------- ikon suit ---------- */
function SuitMark({ size = 34 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22E4C8" />
          <stop offset="100%" stopColor="#9B7BFF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="none" stroke="url(#pbg)" strokeWidth="2" />
      <path d="M24 11c-3 5-7 7-7 11a7 7 0 0 0 14 0c0-4-4-6-7-11z" fill="url(#pbg)" />
      <circle cx="16" cy="32" r="3.4" fill="#F2C14E" />
      <circle cx="32" cy="32" r="3.4" fill="#FF4D6D" />
      <rect x="21.6" y="29" width="4.8" height="4.8" rx="1" transform="rotate(45 24 31.4)" fill="#E6EDF7" />
    </svg>
  );
}

/* ---------- chip disc ---------- */
function Chip({ d, size = 28, qty }) {
  return (
    <span className="chip-wrap">
      <span
        className="chip"
        style={{
          width: size,
          height: size,
          background: d.color,
          color: d.ink,
          fontSize: size * 0.34,
        }}
      >
        {d.value}
      </span>
      {qty !== undefined ? <span className="chip-qty">×{qty}</span> : null}
    </span>
  );
}

/* ---------- kartu mini ---------- */
function MiniCard({ code }) {
  const suit = code.slice(-1);
  const face = code.slice(0, -1);
  const red = suit === "♥" || suit === "♦";
  return (
    <span className={"mcard" + (red ? " red" : "")}>
      <b>{face}</b>
      <i>{suit}</i>
    </span>
  );
}

/* ---------- modal ---------- */
function Sheet({ title, sub, onClose, children }) {
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button className="x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================ */
export default function App() {
  const [tab, setTab] = useState("meja");
  const [cloud, setCloud] = useState("checking");
  const [roster, setRoster] = useState([]);
  const [archive, setArchive] = useState([]);
  const [toast, setToast] = useState(null);

  const [session, setSession] = useState(() => ({
    id: uid(),
    name: "Sesi " + new Date().toLocaleDateString("id-ID"),
    playedAt: new Date().toISOString().slice(0, 10),
    location: "",
    chipRate: 1000,
    maxSeats: 8,
    status: "open",
    mode: "direct",
    bankerId: null,
    adjust: "none",
    seats: [],
  }));

  const [modal, setModal] = useState(null);
  const [paid, setPaid] = useState({});
  const [settlements, setSettlements] = useState([]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  /* ---- cek koneksi + tarik data ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await sbSelect("players", "select=*&order=name");
        if (!alive) return;
        setRoster(p || []);
        setCloud("online");
        const h = await sbSelect(
          "v_session_balance",
          "select=*&status=eq.closed&order=played_at.desc&limit=25"
        );
        if (alive) setArchive(h || []);
      } catch (e) {
        if (alive) setCloud("offline");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---- perhitungan inti ---- */
  const stats = useMemo(() => {
    const rate = Number(session.chipRate) || 0;
    const rows = session.seats.map((s) => {
      const inChips = s.buyins.reduce((a, b) => a + Number(b.chips), 0);
      const outChips = s.final === null ? null : s.final;
      return {
        seatNo: s.seatNo,
        id: s.playerId,
        name: s.name,
        bank: s.bank,
        acct: s.acct,
        buyins: s.buyins,
        inChips,
        outChips,
        inIdr: inChips * rate,
        outIdr: (outChips || 0) * rate,
      };
    });
    const totalIn = rows.reduce((a, r) => a + r.inChips, 0);
    const counted = rows.filter((r) => r.outChips !== null);
    const totalOut = counted.reduce((a, r) => a + r.outChips, 0);
    const variance = counted.length === rows.length && rows.length > 0 ? totalOut - totalIn : null;

    const n = rows.length || 1;
    const adjusted = rows.map((r) => {
      let out = r.outChips === null ? 0 : r.outChips;
      if (variance !== null && variance !== 0) {
        if (session.adjust === "split") out -= variance / n;
        else if (session.adjust === "host" && r.id === session.bankerId) out -= variance;
      }
      const netChips = out - r.inChips;
      return { ...r, adjChips: out, netChips, net: netChips * rate };
    });

    const residual = adjusted.reduce((a, r) => a + r.netChips, 0);
    return {
      rate,
      rows: adjusted,
      totalIn,
      totalOut,
      variance,
      residual,
      allCounted: counted.length === rows.length && rows.length > 0,
      totalInIdr: totalIn * rate,
      totalOutIdr: totalOut * rate,
    };
  }, [session]);

  const balanced = stats.variance === 0 || (stats.variance !== null && session.adjust !== "none");

  /* ---- aksi meja ---- */
  const seatPlayer = (seatNo, player) => {
    setSession((s) => ({
      ...s,
      seats: [
        ...s.seats,
        {
          seatNo,
          playerId: player.id,
          name: player.name,
          bank: player.bank_name || "",
          acct: player.bank_account || "",
          buyins: [],
          final: null,
          breakdown: {},
        },
      ].sort((a, b) => a.seatNo - b.seatNo),
    }));
  };

  const standUp = (seatNo) =>
    setSession((s) => ({ ...s, seats: s.seats.filter((x) => x.seatNo !== seatNo) }));

  const addBuyin = (seatNo, chips, kind) =>
    setSession((s) => ({
      ...s,
      seats: s.seats.map((x) =>
        x.seatNo === seatNo
          ? {
              ...x,
              buyins: [
                ...x.buyins,
                { id: uid(), chips: Number(chips), kind, at: new Date().toISOString() },
              ],
            }
          : x
      ),
    }));

  const dropBuyin = (seatNo, bid) =>
    setSession((s) => ({
      ...s,
      seats: s.seats.map((x) =>
        x.seatNo === seatNo ? { ...x, buyins: x.buyins.filter((b) => b.id !== bid) } : x
      ),
    }));

  const setFinal = (seatNo, breakdown) =>
    setSession((s) => ({
      ...s,
      seats: s.seats.map((x) =>
        x.seatNo === seatNo
          ? { ...x, breakdown, final: breakdownTotal(breakdown) }
          : x
      ),
    }));

  const addPlayer = async (name, bank, acct) => {
    const row = { name, bank_name: bank || null, bank_account: acct || null };
    if (cloud === "online") {
      try {
        const res = await sbInsert("players", [row]);
        const created = res[0];
        setRoster((r) => [...r, created].sort((a, b) => a.name.localeCompare(b.name)));
        return created;
      } catch (e) {
        flash("Gagal simpan ke cloud, pemain dipakai lokal saja");
      }
    }
    const local = { ...row, id: uid(), local: true };
    setRoster((r) => [...r, local].sort((a, b) => a.name.localeCompare(b.name)));
    return local;
  };

  /* ---- settlement ---- */
  const lockAndSettle = () => {
    const nets = stats.rows.map((r) => ({ id: r.id, net: r.net }));
    const list =
      session.mode === "banker" && session.bankerId
        ? bankerTransfers(nets, session.bankerId)
        : minTransfers(nets);
    setSettlements(list);
    setPaid({});
    setSession((s) => ({ ...s, status: "settling" }));
    setTab("bayar");
  };

  const saveToCloud = async () => {
    if (cloud !== "online") {
      flash("Cloud tidak terhubung — data tetap aman di layar ini");
      return;
    }
    try {
      const ses = await sbInsert("sessions", [
        {
          name: session.name,
          played_at: session.playedAt,
          location: session.location || null,
          chip_rate: session.chipRate,
          status: "closed",
          settlement_mode: session.mode,
          banker_player_id:
            session.mode === "banker" && session.bankerId && !String(session.bankerId).startsWith("x")
              ? session.bankerId
              : null,
          max_seats: session.maxSeats,
          ended_at: new Date().toISOString(),
        },
      ]);
      const sid = ses[0].id;
      const spRows = session.seats
        .filter((s) => !String(s.playerId).startsWith("x"))
        .map((s) => ({
          session_id: sid,
          player_id: s.playerId,
          seat_no: s.seatNo,
          final_chips: s.final,
          final_breakdown: s.breakdown,
          counted_at: s.final === null ? null : new Date().toISOString(),
        }));
      const sp = spRows.length ? await sbInsert("session_players", spRows) : [];
      const map = {};
      sp.forEach((r) => {
        map[r.player_id] = r.id;
      });
      const bRows = [];
      session.seats.forEach((s) => {
        if (!map[s.playerId]) return;
        s.buyins.forEach((b) => {
          bRows.push({
            session_id: sid,
            session_player_id: map[s.playerId],
            kind: b.kind,
            chips: b.chips,
            amount_idr: b.chips * session.chipRate,
          });
        });
      });
      if (bRows.length) await sbInsert("buyins", bRows);
      const stRows = settlements
        .filter((t) => map[t.from] && map[t.to])
        .map((t) => ({
          session_id: sid,
          from_player_id: t.from,
          to_player_id: t.to,
          amount_idr: t.amount,
          mode: session.mode,
          is_paid: !!paid[t.from + t.to],
        }));
      if (stRows.length) await sbInsert("settlements", stRows);
      setSession((s) => ({ ...s, status: "closed" }));
      flash("Sesi tersimpan ke cloud");
    } catch (e) {
      flash("Gagal simpan: " + String(e.message).slice(0, 60));
    }
  };

  const newSession = () => {
    setSession({
      id: uid(),
      name: "Sesi " + new Date().toLocaleDateString("id-ID"),
      playedAt: new Date().toISOString().slice(0, 10),
      location: "",
      chipRate: session.chipRate,
      maxSeats: session.maxSeats,
      status: "open",
      mode: session.mode,
      bankerId: null,
      adjust: "none",
      seats: [],
    });
    setSettlements([]);
    setPaid({});
    setTab("meja");
  };

  const nameOf = (id) => {
    const r = stats.rows.find((x) => x.id === id);
    return r ? r.name : "?";
  };

  /* ============================================================ */
  return (
    <div className="app">
      <style>{CSS}</style>

      <header className="top">
        <div className="brand">
          <SuitMark />
          <div>
            <h1>POTBOOK</h1>
            <span>Pembukuan meja, tanpa selisih</span>
          </div>
        </div>
        <div className={"link " + cloud}>
          <i />
          {cloud === "online" ? "Cloud" : cloud === "offline" ? "Lokal" : "…"}
        </div>
      </header>

      <main>
        {tab === "meja" ? (
          <TableView
            session={session}
            setSession={setSession}
            stats={stats}
            roster={roster}
            onSeat={seatPlayer}
            onStand={standUp}
            onBuyin={addBuyin}
            onFinal={setFinal}
            onAddPlayer={addPlayer}
            modal={modal}
            setModal={setModal}
          />
        ) : null}

        {tab === "buku" ? (
          <LedgerView
            session={session}
            setSession={setSession}
            stats={stats}
            balanced={balanced}
            onDropBuyin={dropBuyin}
            onLock={lockAndSettle}
          />
        ) : null}

        {tab === "bayar" ? (
          <SettleView
            session={session}
            setSession={setSession}
            stats={stats}
            settlements={settlements}
            paid={paid}
            setPaid={setPaid}
            nameOf={nameOf}
            onLock={lockAndSettle}
            onSave={saveToCloud}
            onNew={newSession}
          />
        ) : null}

        {tab === "kartu" ? <HandsView /> : null}

        {tab === "arsip" ? <ArchiveView archive={archive} cloud={cloud} /> : null}
      </main>

      <nav className="tabs">
        {[
          ["meja", "Meja", "♠"],
          ["buku", "Buku", "▤"],
          ["bayar", "Bayar", "⇄"],
          ["kartu", "Kartu", "♦"],
          ["arsip", "Arsip", "◷"],
        ].map(([k, label, ic]) => (
          <button
            key={k}
            className={tab === k ? "on" : ""}
            onClick={() => setTab(k)}
          >
            <span className="ic">{ic}</span>
            {label}
          </button>
        ))}
      </nav>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

/* ============================================================
   MEJA
   ============================================================ */
function TableView({
  session,
  setSession,
  stats,
  roster,
  onSeat,
  onStand,
  onBuyin,
  onFinal,
  onAddPlayer,
  modal,
  setModal,
}) {
  const seats = [];
  for (let i = 1; i <= session.maxSeats; i += 1) {
    const occ = session.seats.find((s) => s.seatNo === i);
    seats.push({ seatNo: i, occ });
  }

  const pos = (i, total) => {
    const a = (Math.PI * 2 * (i - 1)) / total - Math.PI / 2;
    return { left: 50 + 43 * Math.cos(a) + "%", top: 50 + 40 * Math.sin(a) + "%" };
  };

  const rowFor = (id) => stats.rows.find((r) => r.id === id);
  const potChips = stats.totalIn;

  return (
    <div className="pad">
      <div className="setup">
        <label>
          <span>Nilai 1 chip</span>
          <div className="rate">
            <b>Rp</b>
            <input
              type="number"
              value={session.chipRate}
              onChange={(e) =>
                setSession((s) => ({ ...s, chipRate: Number(e.target.value) || 0 }))
              }
            />
          </div>
        </label>
        <label>
          <span>Kursi</span>
          <select
            value={session.maxSeats}
            onChange={(e) =>
              setSession((s) => ({ ...s, maxSeats: Number(e.target.value) }))
            }
          >
            {[4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={"felt-wrap" + (stats.variance !== null && stats.variance !== 0 ? " off" : stats.allCounted ? " ok" : "")}>
        <div className="felt">
          <div className="felt-core">
            <div className="pot-label">POT DI MEJA</div>
            <div className="pot-val">{rp(potChips * stats.rate)}</div>
            <div className="pot-sub">{num(potChips)} chip · {session.seats.length} pemain</div>
            <div className="pot-chips">
              {DENOMS.slice(2).map((d) => (
                <Chip key={d.value} d={d} size={22} />
              ))}
            </div>
          </div>
        </div>

        {seats.map((s) => {
          const r = s.occ ? rowFor(s.occ.playerId) : null;
          const style = pos(s.seatNo, session.maxSeats);
          if (!s.occ)
            return (
              <button
                key={s.seatNo}
                className="seat empty"
                style={style}
                onClick={() => setModal({ type: "sit", seatNo: s.seatNo })}
              >
                <span className="plus">+</span>
                <em>{s.seatNo}</em>
              </button>
            );
          const net = r ? r.net : 0;
          const cls = r && r.outChips !== null ? (net > 0 ? "up" : net < 0 ? "down" : "") : "";
          return (
            <button
              key={s.seatNo}
              className={"seat taken " + cls}
              style={style}
              onClick={() => setModal({ type: "player", seatNo: s.seatNo })}
            >
              <span className="ava">{s.occ.name.slice(0, 2).toUpperCase()}</span>
              <em className="nm">{s.occ.name.split(" ")[0]}</em>
              <em className="mn">
                {r && r.outChips !== null ? signed(net) : num(r ? r.inChips : 0) + " chip"}
              </em>
            </button>
          );
        })}
      </div>

      <div className="quickbar">
        <div className="qb-item">
          <span>Masuk</span>
          <b>{rp(stats.totalInIdr)}</b>
        </div>
        <div className="qb-item">
          <span>Keluar</span>
          <b>{stats.allCounted ? rp(stats.totalOutIdr) : "—"}</b>
        </div>
        <div className={"qb-item " + (stats.variance === 0 ? "good" : stats.variance === null ? "" : "bad")}>
          <span>Selisih</span>
          <b>{stats.variance === null ? "—" : signed(stats.variance * stats.rate)}</b>
        </div>
      </div>

      <p className="hint">
        Tap kursi kosong untuk mendudukkan pemain. Tap pemain untuk rebuy atau hitung chip akhirnya.
      </p>

      {modal && modal.type === "sit" ? (
        <SitSheet
          seatNo={modal.seatNo}
          roster={roster}
          taken={session.seats.map((s) => s.playerId)}
          onPick={(p, chips) => {
            onSeat(modal.seatNo, p);
            if (chips > 0) setTimeout(() => onBuyin(modal.seatNo, chips, "buyin"), 0);
            setModal(null);
          }}
          onAddPlayer={onAddPlayer}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal && modal.type === "player" ? (
        <PlayerSheet
          seat={session.seats.find((s) => s.seatNo === modal.seatNo)}
          row={rowFor(session.seats.find((s) => s.seatNo === modal.seatNo).playerId)}
          rate={stats.rate}
          onBuyin={(c, k) => onBuyin(modal.seatNo, c, k)}
          onFinal={(bd) => onFinal(modal.seatNo, bd)}
          onStand={() => {
            onStand(modal.seatNo);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

/* ---------- sheet: dudukkan pemain ---------- */
function SitSheet({ seatNo, roster, taken, onPick, onAddPlayer, onClose }) {
  const [chips, setChips] = useState(100);
  const [newName, setNewName] = useState("");
  const [bank, setBank] = useState("");
  const [acct, setAcct] = useState("");
  const [adding, setAdding] = useState(false);
  const free = roster.filter((p) => !taken.includes(p.id));

  return (
    <Sheet title={"Kursi " + seatNo} sub="Pilih pemain dan buy-in awal" onClose={onClose}>
      <div className="field">
        <span>Buy-in awal (chip)</span>
        <div className="presets">
          {[50, 100, 200, 500].map((c) => (
            <button key={c} className={chips === c ? "on" : ""} onClick={() => setChips(c)}>
              {c}
            </button>
          ))}
          <input
            type="number"
            value={chips}
            onChange={(e) => setChips(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {!adding ? (
        <>
          <div className="list">
            {free.length === 0 ? (
              <p className="empty">Belum ada pemain. Tambahkan dulu di bawah.</p>
            ) : null}
            {free.map((p) => (
              <button key={p.id} className="rowbtn" onClick={() => onPick(p, chips)}>
                <span className="ava sm">{p.name.slice(0, 2).toUpperCase()}</span>
                <span className="rb-main">
                  <b>{p.name}</b>
                  {p.bank_name ? <em>{p.bank_name} · {p.bank_account}</em> : <em>Belum ada rekening</em>}
                </span>
                <span className="go">Dudukkan</span>
              </button>
            ))}
          </div>
          <button className="ghost full" onClick={() => setAdding(true)}>
            + Pemain baru
          </button>
        </>
      ) : (
        <div className="form">
          <label>
            <span>Nama</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama pemain" />
          </label>
          <label>
            <span>Bank</span>
            <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="BCA / Mandiri / OVO" />
          </label>
          <label>
            <span>Nomor rekening</span>
            <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Untuk tombol salin saat transfer" />
          </label>
          <div className="row2">
            <button className="ghost" onClick={() => setAdding(false)}>
              Batal
            </button>
            <button
              className="primary"
              disabled={!newName.trim()}
              onClick={async () => {
                const p = await onAddPlayer(newName.trim(), bank.trim(), acct.trim());
                onPick(p, chips);
              }}
            >
              Simpan &amp; dudukkan
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- sheet: detail pemain ---------- */
function PlayerSheet({ seat, row, rate, onBuyin, onFinal, onStand, onClose }) {
  const [mode, setMode] = useState("rebuy");
  const [chips, setChips] = useState(100);
  const [bd, setBd] = useState(seat.breakdown || {});
  const total = breakdownTotal(bd);

  const bump = (v, delta) =>
    setBd((b) => {
      const next = Math.max(0, (Number(b[v]) || 0) + delta);
      return { ...b, [v]: next };
    });

  return (
    <Sheet
      title={seat.name}
      sub={"Kursi " + seat.seatNo + " · masuk " + num(row.inChips) + " chip"}
      onClose={onClose}
    >
      <div className="segs">
        <button className={mode === "rebuy" ? "on" : ""} onClick={() => setMode("rebuy")}>
          Rebuy
        </button>
        <button className={mode === "count" ? "on" : ""} onClick={() => setMode("count")}>
          Hitung chip akhir
        </button>
      </div>

      {mode === "rebuy" ? (
        <>
          <div className="field">
            <span>Tambah chip</span>
            <div className="presets">
              {[50, 100, 200, 500].map((c) => (
                <button key={c} className={chips === c ? "on" : ""} onClick={() => setChips(c)}>
                  {c}
                </button>
              ))}
              <input type="number" value={chips} onChange={(e) => setChips(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="row2">
            <button className="ghost" onClick={() => onBuyin(chips, "rebuy")}>
              Rebuy {num(chips)}
            </button>
            <button className="primary" onClick={() => onBuyin(chips, "addon")}>
              Add-on {num(chips)}
            </button>
          </div>
          <div className="mini-ledger">
            {row.buyins.length === 0 ? <p className="empty">Belum ada transaksi.</p> : null}
            {row.buyins.map((b, i) => (
              <div key={b.id} className="ml-row">
                <em>{i + 1}</em>
                <span>{b.kind}</span>
                <b>{num(b.chips)} chip</b>
                <i>{rp(b.chips * rate)}</i>
              </div>
            ))}
          </div>
          <button className="danger full" onClick={onStand}>
            Keluarkan dari kursi
          </button>
        </>
      ) : (
        <>
          <div className="counter">
            {DENOMS.map((d) => (
              <div key={d.value} className="cnt-row">
                <Chip d={d} size={34} />
                <span className="cnt-label">{d.label}</span>
                <button onClick={() => bump(d.value, -1)}>−</button>
                <input
                  type="number"
                  value={bd[d.value] || 0}
                  onChange={(e) =>
                    setBd((b) => ({ ...b, [d.value]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                />
                <button onClick={() => bump(d.value, 1)}>+</button>
                <b>{num((Number(bd[d.value]) || 0) * d.value)}</b>
              </div>
            ))}
          </div>
          <div className="count-total">
            <div>
              <span>Total chip</span>
              <b>{num(total)}</b>
            </div>
            <div>
              <span>Nilai</span>
              <b className="gold">{rp(total * rate)}</b>
            </div>
            <div>
              <span>Net</span>
              <b className={total - row.inChips >= 0 ? "up" : "down"}>
                {signed((total - row.inChips) * rate)}
              </b>
            </div>
          </div>
          <button
            className="primary full"
            onClick={() => {
              onFinal(bd);
              onClose();
            }}
          >
            Kunci hitungan
          </button>
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   BUKU
   ============================================================ */
function LedgerView({ session, setSession, stats, balanced, onDropBuyin, onLock }) {
  const v = stats.variance;
  return (
    <div className="pad">
      <h2 className="sec">Buku besar</h2>

      <div className={"guard " + (v === null ? "wait" : v === 0 ? "good" : "bad")}>
        <div className="guard-top">
          <span>{v === null ? "Menunggu hitungan chip" : v === 0 ? "Meja balance" : "Ada selisih"}</span>
          <b>{v === null ? "—" : signed(v * stats.rate)}</b>
        </div>
        <div className="guard-bars">
          <div className="gb">
            <span>Uang masuk</span>
            <b>{rp(stats.totalInIdr)}</b>
          </div>
          <div className="gb">
            <span>Uang keluar</span>
            <b>{stats.allCounted ? rp(stats.totalOutIdr) : "—"}</b>
          </div>
        </div>
        {v !== null && v !== 0 ? (
          <div className="fix">
            <p>
              Chip yang dihitung {v > 0 ? "lebih banyak" : "lebih sedikit"} {num(Math.abs(v))} dari
              yang dibeli. Hitung ulang, atau pilih cara menutupnya:
            </p>
            <div className="segs">
              <button
                className={session.adjust === "none" ? "on" : ""}
                onClick={() => setSession((s) => ({ ...s, adjust: "none" }))}
              >
                Hitung ulang
              </button>
              <button
                className={session.adjust === "split" ? "on" : ""}
                onClick={() => setSession((s) => ({ ...s, adjust: "split" }))}
              >
                Bagi rata
              </button>
              <button
                className={session.adjust === "host" ? "on" : ""}
                onClick={() => setSession((s) => ({ ...s, adjust: "host" }))}
                disabled={!session.bankerId}
              >
                Bebankan ke host
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <h2 className="sec">Posisi pemain</h2>
      <div className="ledger">
        {stats.rows.length === 0 ? <p className="empty">Meja masih kosong.</p> : null}
        {stats.rows.map((r) => (
          <div key={r.id} className="lg-card">
            <div className="lg-head">
              <span className="ava sm">{r.name.slice(0, 2).toUpperCase()}</span>
              <div className="lg-name">
                <b>{r.name}</b>
                <em>Kursi {r.seatNo} · {r.buyins.length}× beli chip</em>
              </div>
              <div className={"lg-net " + (r.outChips === null ? "" : r.net >= 0 ? "up" : "down")}>
                {r.outChips === null ? "belum dihitung" : signed(r.net)}
              </div>
            </div>
            <div className="lg-nums">
              <div>
                <span>Beli</span>
                <b>{num(r.inChips)} chip</b>
                <i>{rp(r.inIdr)}</i>
              </div>
              <div>
                <span>Sisa</span>
                <b>{r.outChips === null ? "—" : num(r.outChips) + " chip"}</b>
                <i>{r.outChips === null ? "" : rp(r.outIdr)}</i>
              </div>
            </div>
            <div className="lg-buyins">
              {r.buyins.map((b, i) => (
                <button
                  key={b.id}
                  className="tag"
                  onClick={() => onDropBuyin(r.seatNo, b.id)}
                  title="Tap untuk hapus"
                >
                  {i === 0 ? "buy-in" : b.kind} {num(b.chips)} ✕
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="primary full big" disabled={!stats.allCounted || !balanced} onClick={onLock}>
        {stats.allCounted ? "Kunci & hitung transfer" : "Hitung chip semua pemain dulu"}
      </button>
    </div>
  );
}

/* ============================================================
   BAYAR
   ============================================================ */
function SettleView({
  session,
  setSession,
  stats,
  settlements,
  paid,
  setPaid,
  nameOf,
  onLock,
  onSave,
  onNew,
}) {
  const rowOf = (id) => stats.rows.find((r) => r.id === id);
  const done = settlements.filter((t) => paid[t.from + t.to]).length;

  const copy = (txt) => {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      /* diabaikan */
    }
    document.body.removeChild(ta);
  };

  return (
    <div className="pad">
      <h2 className="sec">Pola settlement</h2>
      <div className="segs">
        <button
          className={session.mode === "direct" ? "on" : ""}
          onClick={() => setSession((s) => ({ ...s, mode: "direct" }))}
        >
          Antar pemain
        </button>
        <button
          className={session.mode === "banker" ? "on" : ""}
          onClick={() => setSession((s) => ({ ...s, mode: "banker" }))}
        >
          Lewat kasir
        </button>
      </div>

      {session.mode === "banker" ? (
        <div className="field">
          <span>Siapa kasirnya</span>
          <select
            value={session.bankerId || ""}
            onChange={(e) => setSession((s) => ({ ...s, bankerId: e.target.value || null }))}
          >
            <option value="">— pilih pemain —</option>
            {stats.rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button className="ghost full" onClick={onLock} disabled={!stats.allCounted}>
        Hitung ulang transfer
      </button>

      <h2 className="sec">
        Daftar transfer
        {settlements.length ? <em className="cnt">{done}/{settlements.length} lunas</em> : null}
      </h2>

      {settlements.length === 0 ? (
        <p className="empty">Belum ada. Selesaikan hitungan chip di tab Buku dulu.</p>
      ) : null}

      <div className="transfers">
        {settlements.map((t) => {
          const key = t.from + t.to;
          const to = rowOf(t.to);
          return (
            <div key={key} className={"tf" + (paid[key] ? " done" : "")}>
              <div className="tf-flow">
                <span className="ava sm">{nameOf(t.from).slice(0, 2).toUpperCase()}</span>
                <div className="tf-arrow">
                  <b>{rp(t.amount)}</b>
                  <i />
                </div>
                <span className="ava sm to">{nameOf(t.to).slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="tf-names">
                <b>{nameOf(t.from)}</b>
                <span>transfer ke</span>
                <b>{nameOf(t.to)}</b>
              </div>
              {to && to.acct ? (
                <button className="acct" onClick={() => copy(to.acct)}>
                  {to.bank} · {to.acct} <em>salin</em>
                </button>
              ) : null}
              <button
                className={"mark" + (paid[key] ? " on" : "")}
                onClick={() => setPaid((p) => ({ ...p, [key]: !p[key] }))}
              >
                {paid[key] ? "✓ Sudah transfer" : "Tandai lunas"}
              </button>
            </div>
          );
        })}
      </div>

      {settlements.length ? (
        <div className="closing">
          <button className="primary full big" onClick={onSave} disabled={session.status === "closed"}>
            {session.status === "closed" ? "Sesi sudah ditutup" : "Simpan & tutup sesi"}
          </button>
          <button className="ghost full" onClick={onNew}>
            Mulai sesi baru
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   KARTU
   ============================================================ */
function HandsView() {
  const [open, setOpen] = useState(1);
  return (
    <div className="pad">
      <h2 className="sec">Hierarki susunan kartu</h2>
      <p className="lead">Dari yang tidak terkalahkan sampai yang cuma modal gertakan.</p>
      <div className="hands">
        {HANDS.map((h) => (
          <button
            key={h.rank}
            className={"hand" + (open === h.rank ? " open" : "")}
            onClick={() => setOpen(open === h.rank ? 0 : h.rank)}
          >
            <div className="h-top">
              <span className="h-rank">{String(h.rank).padStart(2, "0")}</span>
              <div className="h-title">
                <b>{h.id}</b>
                {h.id !== h.en ? <em>{h.en}</em> : null}
              </div>
              <span className="h-odds">{h.odds}</span>
            </div>
            <div className="h-cards">
              {h.cards.map((c, i) => (
                <MiniCard key={i} code={c} />
              ))}
            </div>
            {open === h.rank ? <p className="h-desc">{h.desc}</p> : null}
          </button>
        ))}
      </div>
      <p className="hint">
        Kalau dua pemain punya susunan sama, kartu tertinggi di dalamnya yang menentukan. Masih
        sama juga, lanjut ke kicker. Habis itu baru pot dibagi dua.
      </p>
    </div>
  );
}

/* ============================================================
   ARSIP
   ============================================================ */
function ArchiveView({ archive, cloud }) {
  return (
    <div className="pad">
      <h2 className="sec">Sesi tersimpan</h2>
      {cloud !== "online" ? (
        <p className="empty">
          Cloud tidak terhubung dari layar ini. Riwayat muncul setelah app dijalankan di
          browser biasa.
        </p>
      ) : archive.length === 0 ? (
        <p className="empty">Belum ada sesi yang ditutup.</p>
      ) : (
        <div className="arch">
          {archive.map((a) => (
            <div key={a.session_id} className="ar-card">
              <div className="ar-head">
                <b>{a.name}</b>
                <em>{a.played_at}</em>
              </div>
              <div className="ar-nums">
                <div>
                  <span>Pemain</span>
                  <b>{a.player_count}</b>
                </div>
                <div>
                  <span>Uang berputar</span>
                  <b>{rp(a.total_in_idr)}</b>
                </div>
                <div>
                  <span>Selisih</span>
                  <b className={Number(a.variance_idr) === 0 ? "up" : "down"}>
                    {signed(Number(a.variance_idr))}
                  </b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLE
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.app{
  --void:#060910; --panel:#0C1322; --panel2:#111C2F; --line:#1E2B45;
  --neon:#22E4C8; --gold:#F2C14E; --crim:#FF4D6D; --viol:#9B7BFF;
  --tx:#E6EDF7; --mut:#7C8BA6;
  min-height:100vh;background:
    radial-gradient(900px 500px at 50% -10%, #10263A 0%, transparent 60%),
    var(--void);
  color:var(--tx);font-family:'Sora',system-ui,sans-serif;
  padding-bottom:76px;
}
.app h1,.app h2,.app h3{font-family:'Chakra Petch',sans-serif;margin:0}
.app b,.app i,.app em{font-style:normal}
input,select,button{font-family:inherit;color:inherit}

/* header */
.top{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;background:rgba(6,9,16,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px}
.brand h1{font-size:19px;letter-spacing:.14em;font-weight:700}
.brand span{font-size:10.5px;color:var(--mut);letter-spacing:.02em}
.link{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut);
  border:1px solid var(--line);border-radius:999px;padding:5px 10px}
.link i{width:6px;height:6px;border-radius:50%;background:var(--mut)}
.link.online i{background:var(--neon);box-shadow:0 0 8px var(--neon)}
.link.offline i{background:var(--gold)}

main{max-width:560px;margin:0 auto}
.pad{padding:16px 16px 28px}
.sec{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--mut);
  margin:22px 0 10px;display:flex;align-items:center;gap:10px}
.sec:first-child{margin-top:6px}
.sec .cnt{margin-left:auto;font-size:11px;color:var(--neon);letter-spacing:.04em;text-transform:none}
.lead{color:var(--mut);font-size:13px;margin:-4px 0 14px}
.hint{color:var(--mut);font-size:12px;line-height:1.6;margin-top:16px}
.empty{color:var(--mut);font-size:13px;padding:14px;border:1px dashed var(--line);border-radius:12px;text-align:center}

/* setup */
.setup{display:flex;gap:10px;margin-bottom:14px}
.setup label{flex:1;display:flex;flex-direction:column;gap:6px}
.setup label span{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.rate{display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:0 12px}
.rate b{color:var(--gold);font-size:13px}
.rate input{flex:1;background:none;border:0;padding:12px 0;font-family:'JetBrains Mono',monospace;font-size:15px;outline:none;width:100%}
.setup select{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:15px;outline:none}

/* MEJA */
.felt-wrap{position:relative;width:100%;aspect-ratio:.86;margin:6px 0 4px}
.felt{position:absolute;inset:13% 12%;border-radius:50%/34%;
  background:radial-gradient(120% 90% at 50% 20%, #0E4A46 0%, #073029 55%, #041B18 100%);
  border:3px solid #1B3A4F;
  box-shadow:0 0 0 8px rgba(11,22,36,.9), 0 0 44px rgba(34,228,200,.10), inset 0 8px 40px rgba(0,0,0,.55);
  transition:box-shadow .4s ease,border-color .4s ease}
.felt-wrap.ok .felt{border-color:var(--neon);box-shadow:0 0 0 8px rgba(11,22,36,.9),0 0 54px rgba(34,228,200,.34),inset 0 8px 40px rgba(0,0,0,.55)}
.felt-wrap.off .felt{border-color:var(--crim);box-shadow:0 0 0 8px rgba(11,22,36,.9),0 0 54px rgba(255,77,109,.34),inset 0 8px 40px rgba(0,0,0,.55);animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 0 8px rgba(11,22,36,.9),0 0 22px rgba(255,77,109,.16),inset 0 8px 40px rgba(0,0,0,.55)}}
.felt-core{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;padding:0 12px}
.pot-label{font-family:'Chakra Petch';font-size:9.5px;letter-spacing:.28em;color:rgba(230,237,247,.45)}
.pot-val{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--gold);
  text-shadow:0 0 22px rgba(242,193,78,.35)}
.pot-sub{font-size:11px;color:rgba(230,237,247,.55)}
.pot-chips{display:flex;gap:4px;margin-top:8px;opacity:.85}

.seat{position:absolute;transform:translate(-50%,-50%);width:64px;
  display:flex;flex-direction:column;align-items:center;gap:3px;
  background:none;border:0;padding:0;cursor:pointer}
.seat.empty .plus{width:40px;height:40px;border-radius:50%;border:1.5px dashed #2C3D5C;color:#4A5B78;
  display:flex;align-items:center;justify-content:center;font-size:20px;background:rgba(12,19,34,.7)}
.seat.empty em{font-size:9.5px;color:#425474;letter-spacing:.1em}
.seat .ava{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:'Chakra Petch';font-weight:700;font-size:14px;letter-spacing:.04em;
  background:linear-gradient(150deg,#1B2A44,#0E1626);border:1.5px solid #2C3D5C;color:var(--tx);
  box-shadow:0 6px 16px rgba(0,0,0,.5)}
.seat.taken.up .ava{border-color:var(--neon);box-shadow:0 0 18px rgba(34,228,200,.4)}
.seat.taken.down .ava{border-color:var(--crim);box-shadow:0 0 18px rgba(255,77,109,.35)}
.seat .nm{font-size:10.5px;font-weight:600;max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.seat .mn{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--mut)}
.seat.up .mn{color:var(--neon)}
.seat.down .mn{color:var(--crim)}

.quickbar{display:flex;gap:8px;margin-top:10px}
.qb-item{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:11px 12px}
.qb-item span{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:4px}
.qb-item b{font-family:'JetBrains Mono',monospace;font-size:13px}
.qb-item.good b{color:var(--neon)}
.qb-item.bad{border-color:rgba(255,77,109,.5)}
.qb-item.bad b{color:var(--crim)}

/* chip */
.chip-wrap{display:inline-flex;align-items:center;gap:5px}
.chip{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;
  font-family:'JetBrains Mono',monospace;font-weight:700;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.28), inset 0 0 0 5px rgba(0,0,0,.10), 0 3px 8px rgba(0,0,0,.45);
  flex:none}
.chip-qty{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--mut)}

/* guard */
.guard{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--panel)}
.guard.good{border-color:rgba(34,228,200,.45);background:linear-gradient(180deg,rgba(34,228,200,.07),transparent)}
.guard.bad{border-color:rgba(255,77,109,.5);background:linear-gradient(180deg,rgba(255,77,109,.08),transparent)}
.guard-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.guard-top span{font-family:'Chakra Petch';font-size:14px;font-weight:600}
.guard-top b{font-family:'JetBrains Mono',monospace;font-size:16px}
.guard.good .guard-top b{color:var(--neon)}
.guard.bad .guard-top b{color:var(--crim)}
.guard-bars{display:flex;gap:8px}
.gb{flex:1;background:rgba(255,255,255,.03);border-radius:10px;padding:9px 10px}
.gb span{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-bottom:3px}
.gb b{font-family:'JetBrains Mono',monospace;font-size:13px}
.fix{margin-top:12px;border-top:1px solid var(--line);padding-top:12px}
.fix p{font-size:12.5px;color:var(--mut);line-height:1.6;margin:0 0 10px}

/* ledger */
.lg-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px;margin-bottom:10px}
.lg-head{display:flex;align-items:center;gap:10px}
.ava.sm{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:'Chakra Petch';font-weight:700;font-size:12px;flex:none;
  background:linear-gradient(150deg,#1B2A44,#0E1626);border:1px solid #2C3D5C}
.ava.sm.to{border-color:var(--neon)}
.lg-name{flex:1;min-width:0}
.lg-name b{display:block;font-size:14px}
.lg-name em{font-size:11px;color:var(--mut)}
.lg-net{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--mut)}
.lg-net.up{color:var(--neon)}
.lg-net.down{color:var(--crim)}
.lg-nums{display:flex;gap:8px;margin-top:11px}
.lg-nums>div{flex:1;background:rgba(255,255,255,.03);border-radius:10px;padding:8px 10px}
.lg-nums span{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.lg-nums b{font-family:'JetBrains Mono',monospace;font-size:12.5px;display:block;margin-top:2px}
.lg-nums i{font-size:10.5px;color:var(--mut)}
.lg-buyins{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tag{background:rgba(155,123,255,.12);border:1px solid rgba(155,123,255,.3);color:#C3B0FF;
  border-radius:999px;padding:4px 9px;font-size:10.5px;cursor:pointer}

/* transfer */
.tf{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:10px}
.tf.done{opacity:.55;border-color:rgba(34,228,200,.4)}
.tf-flow{display:flex;align-items:center;gap:10px}
.tf-arrow{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px}
.tf-arrow b{font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--gold)}
.tf-arrow i{display:block;width:100%;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,var(--viol),var(--neon))}
.tf-names{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:9px;font-size:12.5px}
.tf-names span{color:var(--mut);font-size:11px}
.acct{width:100%;margin-top:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);
  border-radius:10px;padding:9px 12px;font-family:'JetBrains Mono',monospace;font-size:11.5px;
  display:flex;justify-content:space-between;align-items:center;cursor:pointer}
.acct em{color:var(--neon);font-family:'Sora';font-size:11px}
.mark{width:100%;margin-top:9px;background:none;border:1px solid var(--line);border-radius:10px;
  padding:10px;font-size:12.5px;cursor:pointer;color:var(--mut)}
.mark.on{border-color:var(--neon);color:var(--neon);background:rgba(34,228,200,.08)}
.closing{margin-top:18px;display:flex;flex-direction:column;gap:9px}

/* hands */
.hand{width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:13px;margin-bottom:9px;cursor:pointer;display:block;transition:border-color .2s}
.hand.open{border-color:rgba(155,123,255,.5);background:linear-gradient(180deg,rgba(155,123,255,.07),transparent)}
.h-top{display:flex;align-items:center;gap:11px}
.h-rank{font-family:'JetBrains Mono',monospace;font-size:16px;color:#33455F;font-weight:700}
.hand.open .h-rank{color:var(--viol)}
.h-title{flex:1;min-width:0}
.h-title b{display:block;font-family:'Chakra Petch';font-size:15px;font-weight:600}
.h-title em{font-size:10.5px;color:var(--mut);letter-spacing:.04em}
.h-odds{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--mut);flex:none}
.h-cards{display:flex;gap:5px;margin-top:11px}
.h-desc{font-size:12.5px;color:var(--mut);line-height:1.6;margin:11px 0 0}
.mcard{width:34px;height:46px;border-radius:5px;background:linear-gradient(170deg,#FDFEFF,#DFE7F2);
  color:#0B1220;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:'Chakra Petch';box-shadow:0 3px 9px rgba(0,0,0,.5);flex:none}
.mcard b{font-size:13px;line-height:1;font-weight:700}
.mcard i{font-size:13px;line-height:1.2}
.mcard.red{color:#D01B3C}

/* arsip */
.ar-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px;margin-bottom:10px}
.ar-head{display:flex;justify-content:space-between;align-items:baseline}
.ar-head b{font-family:'Chakra Petch';font-size:14px}
.ar-head em{font-size:11px;color:var(--mut)}
.ar-nums{display:flex;gap:8px;margin-top:11px}
.ar-nums>div{flex:1;background:rgba(255,255,255,.03);border-radius:10px;padding:8px 10px}
.ar-nums span{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.ar-nums b{font-family:'JetBrains Mono',monospace;font-size:12.5px}
.ar-nums b.up{color:var(--neon)}
.ar-nums b.down{color:var(--crim)}

/* sheet */
.sheet-back{position:fixed;inset:0;z-index:60;background:rgba(3,6,12,.72);backdrop-filter:blur(6px);
  display:flex;align-items:flex-end;justify-content:center;animation:fade .18s ease}
@keyframes fade{from{opacity:0}}
.sheet{width:100%;max-width:560px;max-height:90vh;overflow-y:auto;background:var(--panel2);
  border:1px solid var(--line);border-bottom:0;border-radius:22px 22px 0 0;padding:10px 16px 26px;
  animation:rise .26s cubic-bezier(.2,.9,.3,1)}
@keyframes rise{from{transform:translateY(24px)}}
.sheet-grip{width:36px;height:4px;border-radius:4px;background:#2A3A55;margin:0 auto 12px}
.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.sheet-head h3{font-size:18px}
.sheet-head p{margin:3px 0 0;font-size:11.5px;color:var(--mut)}
.x{background:none;border:1px solid var(--line);border-radius:9px;width:30px;height:30px;color:var(--mut);cursor:pointer}

.field{margin-bottom:14px}
.field>span{display:block;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:8px}
.field select{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:15px}
.presets{display:flex;gap:7px;flex-wrap:wrap}
.presets button{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 14px;
  font-family:'JetBrains Mono',monospace;font-size:13px;cursor:pointer;color:var(--mut)}
.presets button.on{border-color:var(--neon);color:var(--neon);background:rgba(34,228,200,.09)}
.presets input{flex:1;min-width:80px;background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:9px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none}

.segs{display:flex;gap:7px;margin-bottom:14px}
.segs button{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:10px;
  font-size:12.5px;cursor:pointer;color:var(--mut)}
.segs button.on{border-color:var(--viol);color:#C3B0FF;background:rgba(155,123,255,.1)}
.segs button:disabled{opacity:.4}

.list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.rowbtn{display:flex;align-items:center;gap:11px;background:var(--panel);border:1px solid var(--line);
  border-radius:13px;padding:11px;cursor:pointer;text-align:left;width:100%}
.rb-main{flex:1;min-width:0}
.rb-main b{display:block;font-size:14px}
.rb-main em{font-size:10.5px;color:var(--mut)}
.go{font-size:11px;color:var(--neon);flex:none}

.form label{display:block;margin-bottom:11px}
.form label span{display:block;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.form input{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px;font-size:15px;outline:none}
.form input:focus,.presets input:focus,.rate input:focus{border-color:var(--neon)}

.row2{display:flex;gap:8px}
.row2>button{flex:1}
button.primary{background:linear-gradient(120deg,var(--neon),#5CC7FF);color:#04211D;border:0;
  border-radius:12px;padding:13px;font-weight:600;font-size:13.5px;cursor:pointer}
button.primary:disabled{background:#1A2438;color:#4C5C78;cursor:not-allowed}
button.ghost{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px;
  font-size:13.5px;cursor:pointer;color:var(--tx)}
button.ghost:disabled{opacity:.4;cursor:not-allowed}
button.danger{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.4);color:var(--crim);
  border-radius:12px;padding:12px;font-size:13px;cursor:pointer}
button.full{width:100%;margin-top:10px}
button.big{padding:16px;font-size:14.5px}

.mini-ledger{margin-top:14px}
.ml-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.ml-row em{width:18px;font-family:'JetBrains Mono',monospace;color:var(--mut);font-size:11px}
.ml-row span{flex:1;color:var(--mut);font-size:11.5px;text-transform:capitalize}
.ml-row b{font-family:'JetBrains Mono',monospace;font-size:12.5px}
.ml-row i{font-family:'JetBrains Mono',monospace;color:var(--gold);font-size:11.5px;width:88px;text-align:right}

.counter{display:flex;flex-direction:column;gap:8px}
.cnt-row{display:flex;align-items:center;gap:9px}
.cnt-label{width:52px;font-size:11.5px;color:var(--mut)}
.cnt-row button{width:34px;height:34px;border-radius:9px;background:var(--panel);border:1px solid var(--line);
  font-size:17px;cursor:pointer;color:var(--tx);flex:none;line-height:1}
.cnt-row input{width:56px;background:var(--panel);border:1px solid var(--line);border-radius:9px;
  padding:8px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:14px;outline:none}
.cnt-row b{flex:1;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--mut)}
.count-total{display:flex;gap:8px;margin:15px 0 4px}
.count-total>div{flex:1;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:10px}
.count-total span{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-bottom:3px}
.count-total b{font-family:'JetBrains Mono',monospace;font-size:13px}
.count-total .gold{color:var(--gold)}
.count-total .up{color:var(--neon)}
.count-total .down{color:var(--crim)}

/* tabs */
.tabs{position:fixed;bottom:0;left:0;right:0;z-index:40;display:flex;
  background:rgba(6,9,16,.94);backdrop-filter:blur(16px);border-top:1px solid var(--line);
  padding:7px 6px calc(7px + env(safe-area-inset-bottom))}
.tabs button{flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:6px 2px;font-size:10px;color:var(--mut);cursor:pointer;letter-spacing:.03em}
.tabs .ic{font-size:16px;line-height:1}
.tabs button.on{color:var(--neon)}
.tabs button.on .ic{text-shadow:0 0 12px rgba(34,228,200,.7)}

.toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%);z-index:70;
  background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:11px 16px;
  font-size:12.5px;max-width:88%;box-shadow:0 10px 30px rgba(0,0,0,.6)}

@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important}
}
@media (min-width:600px){
  .felt-wrap{aspect-ratio:1.28}
  .felt{inset:16% 8%}
}
`;
