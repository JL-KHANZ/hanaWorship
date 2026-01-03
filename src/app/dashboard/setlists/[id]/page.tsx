"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import styles from "./viewer.module.css";
import { FaDownload, FaArrowLeft, FaPrint } from "react-icons/fa";
import jsPDF from "jspdf";

export default function SetlistViewerPage() {
    const { id } = useParams();
    const router = useRouter();
    const [setlist, setSetlist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchSet = async () => {
            try {
                const docRef = doc(db, "setlists", id as string);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setSetlist({ id: snap.id, ...snap.data() });
                } else {
                    alert("Setlist not found");
                    router.push("/dashboard/setlists");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchSet();
    }, [id, router]);

    const generatePDF = async () => {
        if (!setlist || !setlist.songs) return;
        setGeneratingPdf(true);

        try {
            const doc = new jsPDF();
            let pageAdded = false;

            for (const song of setlist.songs) {
                if (!song.imageUrl) continue;

                if (pageAdded) {
                    doc.addPage();
                }

                // Add Title
                doc.setFontSize(16);
                doc.text(`${song.songName} (${song.songKey})`, 10, 10);

                // Fetch Image
                // We need to fetch the image as blob/base64 to add to jsPDF
                try {
                    // Cross-origin might be an issue. 
                    const response = await fetch(song.imageUrl, { mode: 'cors' });
                    const blob = await response.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });

                    const imgProps = doc.getImageProperties(base64 as string);
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    doc.addImage(base64 as string, 'JPEG', 0, 20, pdfWidth, pdfHeight);
                    pageAdded = true;
                } catch (err) {
                    console.error("Failed to load image for PDF", err);
                    // Optionally add a text placeholder
                    doc.text("Could not load image", 10, 30);
                    pageAdded = true;
                }
            }

            doc.save(`${setlist.name.replace(/\s+/g, '_')}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Failed to generate PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (loading) return <div className="p-8 text-center">콘티 불러오는 중...</div>;
    if (!setlist) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 mb-2">
                        <FaArrowLeft /> 목록으로
                    </button>
                    <h1 className={`${styles.title} premium-gradient`}>{setlist.name}</h1>
                    <div className={styles.date}>
                        예배 날짜: {new Date(setlist.setTargetDate).toLocaleDateString()}
                    </div>
                </div>

                <div className={styles.controls}>
                    <button onClick={generatePDF} disabled={generatingPdf} className={styles.primaryBtn}>
                        {generatingPdf ? "생성 중..." : <><FaDownload /> PDF 다운로드</>}
                    </button>
                </div>
            </div>

            <div className={styles.viewerContainer}>
                {setlist.songs?.map((song: any, idx: number) => (
                    <div key={idx} className={styles.songWrapper}>
                        <div className={styles.songHeader}>
                            <div className={styles.songTitle}>
                                <span className="opacity-50 text-base mr-3">#{idx + 1}</span>
                                {song.songName}
                            </div>
                            <div className={styles.songMeta}>
                                {song.songKey} • {song.songArtist}
                            </div>
                        </div>
                        {song.imageUrl ? (
                            <img src={song.imageUrl} className={styles.sheetImage} alt={song.songName} />
                        ) : (
                            <div className="h-40 bg-[var(--surface-1)] flex items-center justify-center rounded-lg border border-[var(--surface-border)]">
                                이미지가 없습니다
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
