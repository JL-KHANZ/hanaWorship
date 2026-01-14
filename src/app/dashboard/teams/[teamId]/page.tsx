"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, onSnapshot, setDoc, deleteDoc, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import styles from "../teams.module.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Link from "next/link";
import { FaTrash, FaExternalLinkAlt } from "react-icons/fa";

type Event = {
    id?: string;
    date: string; // YYYY-MM-DD
    setlistId: string;
    setlistName: string;
};

export default function TeamCalendarPage() {
    const { teamId } = useParams();
    const { user } = useAuth();
    const [team, setTeam] = useState<any>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [mySetlists, setMySetlists] = useState<any[]>([]);
    const [selectedSetlistId, setSelectedSetlistId] = useState("");

    // Fetch Team & Events
    useEffect(() => {
        if (!teamId) return;

        // Team Info
        getDoc(doc(db, "teams", teamId as string)).then(snap => {
            if (snap.exists()) setTeam(snap.data());
        });

        // Events
        const q = query(collection(db, "teams", teamId as string, "events"));
        const unsub = onSnapshot(q, (snap) => {
            const evs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Event));
            setEvents(evs);
        });

        return () => unsub();
    }, [teamId]);

    // Fetch My Setlists for assignment
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "setlists"), where("setOwner", "==", user.uid));
        getDoc(doc(db, "users", user.uid)).then(() => {
            // Optimization: just use getDocs if not realtime
        });
        const unsub = onSnapshot(q, (snap) => {
            setMySetlists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [user]);

    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const handleAssign = async () => {
        if (!selectedSetlistId || !teamId) return;
        const dateStr = formatDate(selectedDate);
        const setlist = mySetlists.find(s => s.id === selectedSetlistId);

        try {
            // Use date as ID to ensure one event per date (or auto-id if multiple allowed. Requirement implies "which setlist is set to when", usually one per service? I'll use Date as ID to simplify: one set per day).
            await setDoc(doc(db, "teams", teamId as string, "events", dateStr), {
                date: dateStr,
                setlistId: setlist.id,
                setlistName: setlist.name
            });
            setSelectedSetlistId("");
        } catch (e) {
            console.error(e);
            alert("Failed to assign");
        }
    };

    const handleRemoveEvent = async () => {
        const dateStr = formatDate(selectedDate);
        try {
            await deleteDoc(doc(db, "teams", teamId as string, "events", dateStr));
        } catch (e) { console.error(e); }
    };

    const selectedDateStr = formatDate(selectedDate);
    const eventForDate = events.find(e => e.date === selectedDateStr);

    return (
        <div className="animate-fade-in relative min-h-screen">
            <div className={styles.header}>
                <div>
                    <Link href="/dashboard/teams" className="text-sm opacity-60 hover:opacity-100 mb-2 block">← 팀 목록으로 돌아가기</Link>
                    <h1 className="text-3xl font-bold">{team?.name}</h1>
                    <p className="opacity-60 text-sm">참여 코드: {team?.joinCode} • 멤버 {team?.members?.length}명</p>
                </div>
            </div>

            <div className={styles.calendarContainer}>
                <div className={styles.calendarWrapper}>
                    <Calendar
                        onChange={(val) => setSelectedDate(val as Date)}
                        value={selectedDate}
                        tileContent={({ date, view }) => {
                            if (view === 'month') {
                                const dStr = formatDate(date);
                                const hasEvent = events.some(e => e.date === dStr);
                                return hasEvent ? <div className={styles.eventDot}></div> : null;
                            }
                        }}
                    />
                </div>

                <div className={styles.sidebar}>
                    <h3 className={styles.sidebarTitle}>
                        {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>

                    {eventForDate ? (
                        <div className={styles.eventItem}>
                            <Link href={`/dashboard/setlists/${eventForDate.setlistId}`} className={styles.eventItemLink}>
                                <div className={styles.eventItemName}>
                                    <span>{eventForDate.setlistName}</span>
                                </div>
                            </Link>
                            <button onClick={handleRemoveEvent} className={styles.eventRemoveButton}><FaTrash /></button>
                        </div>
                    ) : (
                        <div className={styles.eventItem}>
                            <select
                                className={styles.select}
                                value={selectedSetlistId}
                                onChange={e => setSelectedSetlistId(e.target.value)}
                            >
                                <option value="">콘티 선택...</option>
                                {mySetlists.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedSetlistId}
                                className="w-full bg-[var(--primary)] text-white py-2 rounded-lg font-semibold disabled:opacity-50"
                            >
                                {selectedDate.toLocaleDateString()} 에 지정
                            </button>
                            {/* <p className="text-xs opacity-50 mt-2 text-center">내가 작성한 콘티만 표시됩니다</p> */}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
