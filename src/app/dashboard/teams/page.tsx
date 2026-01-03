"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, arrayUnion, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import styles from "./teams.module.css";
import { FaUsers } from "react-icons/fa";

export default function TeamsPage() {
    const { user } = useAuth();
    const [teams, setTeams] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);

    const [createName, setCreateName] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [joinCode, setJoinCode] = useState("");

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "teams"), where("members", "array-contains", user.uid));
        const unsub = onSnapshot(q, (snap) => {
            setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [user]);

    const handleCreate = async () => {
        if (!createName) return;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            await addDoc(collection(db, "teams"), {
                name: createName,
                description: createDesc,
                joinCode: code,
                members: [user?.uid],
                admins: [user?.uid],
                createdAt: new Date().toISOString()
            });
            setShowCreate(false);
            setCreateName("");
            setCreateDesc("");
        } catch (e) {
            console.error(e);
            alert("Failed to create team");
        }
    };

    const handleJoin = async () => {
        if (!joinCode) return;
        try {
            const q = query(collection(db, "teams"), where("joinCode", "==", joinCode.trim().toUpperCase()));
            const snap = await getDocs(q);
            if (snap.empty) {
                alert("Invalid code");
                return;
            }
            const teamDoc = snap.docs[0];
            // Check if already member
            if (teamDoc.data().members.includes(user?.uid)) {
                alert("Already a member");
                setShowJoin(false);
                return;
            }
            await updateDoc(teamDoc.ref, {
                members: arrayUnion(user?.uid)
            });
            setShowJoin(false);
            setJoinCode("");
        } catch (e) {
            console.error(e);
            alert("Failed to join team");
        }
    };

    return (
        <div className="animate-fade-in relative">
            <div className={styles.header}>
                <h1 className="text-3xl font-bold">워십 팀</h1>
                <div className={styles.actionBtns}>
                    <button onClick={() => setShowJoin(true)} className={styles.joinBtn}>팀 가입하기</button>
                    <button onClick={() => setShowCreate(true)} className={styles.createBtn}>+ 팀 만들기</button>
                </div>
            </div>

            <div className={styles.grid}>
                {teams.length === 0 && (
                    <div className="col-span-full text-center p-12 opacity-50 border-2 border-dashed border-[var(--surface-border)] rounded-xl">
                        <p>가입된 팀이 없습니다.</p>
                    </div>
                )}

                {teams.map(team => (
                    <Link key={team.id} href={`/dashboard/teams/${team.id}`} className={styles.teamCard}>
                        <div>
                            <div className={styles.teamName}>{team.name}</div>
                            <p className="opacity-70 text-sm mb-4">{team.description}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm opacity-60">
                            <FaUsers />
                            <span>{team.members.length} Members</span>
                        </div>
                        <div className="mt-4 text-xs font-mono bg-black/30 p-2 rounded inline-block w-fit">
                            Code: {team.joinCode}
                        </div>
                    </Link>
                ))}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle}>새 팀 만들기</h2>
                        <input className={styles.input} placeholder="팀 이름" value={createName} onChange={e => setCreateName(e.target.value)} />
                        <input className={styles.input} placeholder="팀 설명" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowCreate(false)} className={styles.cancelBtn}>취소</button>
                            <button onClick={handleCreate} className={styles.submitBtn}>만들기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Join Modal */}
            {showJoin && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle}>팀 가입하기</h2>
                        <input className={styles.input} placeholder="팀 코드 입력" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowJoin(false)} className={styles.cancelBtn}>취소</button>
                            <button onClick={handleJoin} className={styles.submitBtn}>가입하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
