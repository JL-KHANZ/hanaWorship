"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./manager.module.css";
import { IKContext, IKUpload } from "imagekitio-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { FaQuestionCircle, FaTimes, FaList, FaPen } from "react-icons/fa";

const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

export default function ManagerPage() {
    // ... existing hooks ...
    const { user, isManager, loading } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'register' | 'review'>('register');
    const [pendingUploads, setPendingUploads] = useState<any[]>([]);
    const [promotingTempId, setPromotingTempId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        songName: "",
        songKey: "C",
        songCategory: "상향",
        songArtist: "",
        songArrangedBy: "",
        songBpm: "",
        songLanguage: "한국어"
    });
    // ... existing state ...
    const [uploading, setUploading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [success, setSuccess] = useState("");
    const [uploadedImage, setUploadedImage] = useState<any>(null);
    const [existingMatches, setExistingMatches] = useState<any[]>([]);
    const [preCheckLoading, setPreCheckLoading] = useState(false);

    // ... existing useEffects ...

    // Fetch Pending Uploads
    useEffect(() => {
        if (activeTab === 'review') {
            const fetchPending = async () => {
                const q = query(collection(db, "temporary_music_sheets"), where("status", "==", "pending"), orderBy("createdAt", "desc"));

                try {
                    const snap = await getDocs(q);
                    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setPendingUploads(docs);
                } catch (e) {
                    console.error("Failed to fetch pending uploads", e);
                }
            };
            fetchPending();
        }
    }, [activeTab]);

    const handleSelectTemp = (item: any) => {
        setPromotingTempId(item.id);
        setFormData({
            songName: "", // User fills this
            songKey: item.songKey || "C",
            songCategory: "상향",
            songArtist: item.songArtist === "Unknown" ? "" : item.songArtist,
            songArrangedBy: "",
            songBpm: "",
            songLanguage: "한국어"
        });

        // Load image
        setUploadedImage([{
            url: item.imageUrl,
            thumbnailUrl: item.thumbnailUrl,
            filePath: item.filePath,
            fileId: item.imageIds?.[0] // Assuming single file for now or array
        }]);

        setActiveTab('register');
        setSuccess("임시 악보를 불러왔습니다. 정보를 입력하고 저장하면 정식 등록됩니다.");
    };

    // Cleanup helper
    const cleanupUploadedImages = async (images: any[]) => {
        if (!images || images.length === 0) return;
        try {
            const fileIds = images.map(img => img.fileId).filter(Boolean);
            if (fileIds.length > 0) {
                await fetch("/api/imagekit/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileIds })
                });
            }
        } catch (e) {
            console.error("Cleanup failed", e);
        }
    };

    // Prevent flash of content
    if (loading || !isManager) return <div className={styles.loadingGuard}>권한 확인 중...</div>;

    const handleChange = (e: any) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const onSuccess = (res: any) => {
        setUploading(false);
        setUploadedImage((prev: any) => {
            if (!prev) return [res];
            return [...prev, res];
        });
    };

    const onError = (err: any) => {
        setUploading(false);
        console.error("Upload Error", err);
        alert("업로드 실패. 콘솔을 확인하세요.");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadedImage || uploadedImage.length === 0) {
            alert("이미지를 먼저 업로드해주세요");
            return;
        }

        try {
            // 1. Query for potential duplicates (Same Name & Artist)
            const q = query(
                collection(db, "music_sheets"),
                where("songName", "==", formData.songName),
                where("songArtist", "==", formData.songArtist)
            );
            const querySnapshot = await getDocs(q);

            let exactMatchDoc = null;

            // 2. Find exact match for Key and Arranger
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.songKey === formData.songKey && data.songArrangedBy === formData.songArrangedBy) {
                    exactMatchDoc = doc;
                }
            });

            const mainImage = uploadedImage[0];
            const pages = uploadedImage.map((img: any) => img.url);
            const imageIds = uploadedImage.map((img: any) => img.fileId).filter(Boolean);

            let finalDocId = null;
            let finalSongData: any = null;

            if (exactMatchDoc) {
                // 3. Conflict Check
                const existingData = (exactMatchDoc as any).data();
                const newCategory = formData.songCategory;
                const newBpm = formData.songBpm;
                const newLanguage = formData.songLanguage;

                let categoryConflict = false;
                if (existingData.songCategory && Array.isArray(existingData.songCategory) && existingData.songCategory.length > 0) {
                    if (!existingData.songCategory.includes(newCategory)) {
                        categoryConflict = true;
                    }
                }

                let bpmConflict = false;
                if (existingData.songBpm && String(existingData.songBpm).trim() !== "" && newBpm && String(newBpm).trim() !== "") {
                    if (String(existingData.songBpm) !== String(newBpm)) {
                        bpmConflict = true;
                    }
                }

                let languageConflict = false;
                if (existingData.songLanguage && existingData.songLanguage !== newLanguage) {
                    languageConflict = true;
                }

                if (categoryConflict || bpmConflict || languageConflict) {
                    let msg = "이미 존재하는 악보와 데이터가 충돌합니다.\n";
                    if (categoryConflict) msg += `- 카테고리 불일치 (기존: ${existingData.songCategory}, 입력: ${newCategory})\n`;
                    if (bpmConflict) msg += `- BPM 불일치 (기존: ${existingData.songBpm}, 입력: ${newBpm})\n`;
                    if (languageConflict) msg += `- 언어 불일치 (기존: ${existingData.songLanguage}, 입력: ${newLanguage})\n`;
                    msg += "동일한 편곡/키의 악보는 데이터가 일치해야 합니다.";
                    alert(msg);

                    await cleanupUploadedImages(uploadedImage);
                    setUploadedImage(null);
                    return;
                }

                // 4. Update Existing Song
                finalDocId = (exactMatchDoc as any).id;
                const docRef = doc(db, "music_sheets", finalDocId);

                const updateData: any = {
                    imageUrl: mainImage.url,
                    thumbnailUrl: mainImage.thumbnailUrl || mainImage.url,
                    filePath: mainImage.filePath,
                    pages: pages,
                    imageIds: imageIds,
                    updatedAt: serverTimestamp(),
                    updatedBy: user?.uid
                };

                if (!existingData.songBpm && newBpm) updateData.songBpm = newBpm;
                if (!existingData.songLanguage && newLanguage) updateData.songLanguage = newLanguage;
                if ((!existingData.songCategory || existingData.songCategory.length === 0) && newCategory) {
                    updateData.songCategory = [newCategory];
                }

                await updateDoc(docRef, updateData);
                finalSongData = { ...existingData, ...updateData, id: finalDocId };
                setSuccess("기존 악보가 성공적으로 업데이트되었습니다! (이미지 및 페이지 갱신됨)");
            } else {
                // 5. Create New Song
                const newData = {
                    ...formData,
                    songCategory: formData.songCategory.split(",").map(s => s.trim()),
                    imageUrl: mainImage.url,
                    thumbnailUrl: mainImage.thumbnailUrl || mainImage.url,
                    filePath: mainImage.filePath,
                    pages: pages,
                    imageIds: imageIds,
                    uploadedBy: user?.uid,
                    createdAt: serverTimestamp(),
                };
                const docRef = await addDoc(collection(db, "music_sheets"), newData);
                finalDocId = docRef.id;
                finalSongData = { ...newData, id: finalDocId };
                setSuccess("새로운 악보가 성공적으로 등록되었습니다!");
            }

            // 6. Handle Promotion / Migration
            if (promotingTempId && finalDocId && finalSongData) {
                const setQuery = query(collection(db, "setlists"));
                const setSnap = await getDocs(setQuery);

                const updatePromises = setSnap.docs.map(async (sDoc) => {
                    const sData = sDoc.data();
                    if (sData.songs && Array.isArray(sData.songs)) {
                        const needsUpdate = sData.songs.some((s: any) => s.id === promotingTempId);
                        if (needsUpdate) {
                            const newSongs = sData.songs.map((s: any) => {
                                if (s.id === promotingTempId) {
                                    return {
                                        ...s,
                                        ...finalSongData,
                                        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                                        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                                        id: finalDocId,
                                        isTemporary: false
                                    };
                                }
                                return s;
                            });
                            return updateDoc(doc(db, "setlists", sDoc.id), { songs: newSongs });
                        }
                    }
                    return Promise.resolve();
                });

                await Promise.all(updatePromises);

                // Delete Temp Doc
                await deleteDoc(doc(db, "temporary_music_sheets", promotingTempId));
                setPromotingTempId(null);
                setPendingUploads(prev => prev.filter(p => p.id !== promotingTempId));
            }

            setFormData({
                songName: "",
                songKey: "C",
                songCategory: "상향",
                songArtist: "",
                songArrangedBy: "",
                songBpm: "",
                songLanguage: "한국어"
            });
            setUploadedImage(null);

        } catch (error) {
            console.error("Error saving doc", error);
            alert("저장에 실패했습니다.");
        }
    };

    const authenticator = async () => {
        try {
            const response = await fetch("/api/imagekit/auth");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            const { signature, expire, token } = data;
            return { signature, expire, token };
        } catch (error: any) {
            throw new Error(`Authentication request failed: ${error.message}`);
        }
    };

    const getIdentityStatus = () => {
        if (preCheckLoading) return { label: "확인 중...", className: styles.statusNew };
        if (!formData.songName || formData.songName.length < 2) return null;

        const nameArtistMatch = existingMatches.filter(m =>
            m.songName === formData.songName.trim() &&
            m.songArtist === formData.songArtist.trim()
        );

        if (nameArtistMatch.length === 0) return { label: "✨ 신규 곡", className: styles.statusNew, conflict: false };

        const exactMatch = nameArtistMatch.find(m =>
            m.songKey === formData.songKey &&
            m.songArrangedBy === formData.songArrangedBy
        );

        if (exactMatch) {
            const hasConflict =
                (exactMatch.songBpm && formData.songBpm && String(exactMatch.songBpm) !== String(formData.songBpm)) ||
                (exactMatch.songLanguage && exactMatch.songLanguage !== formData.songLanguage);

            if (hasConflict) return { label: "⚠️ 데이터 충돌", className: styles.statusConflict, conflict: true };
            return { label: "📝 기존 곡 업데이트", className: styles.statusUpdate, conflict: false };
        }

        return { label: "📄 다른 버전 등록", className: styles.statusUpdate, conflict: false };
    };

    const status = getIdentityStatus();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={`${styles.title} premium-gradient !mb-0`}>매니저 패널</h1>
            </div>

            <div className={styles.tabBar}>
                <button
                    onClick={() => setActiveTab('register')}
                    className={`${styles.tabBtn} ${activeTab === 'register' ? styles.tabBtnActive : ''}`}
                >
                    악보 등록
                </button>
                <button
                    onClick={() => setActiveTab('review')}
                    className={`${styles.tabBtn} ${activeTab === 'review' ? styles.tabBtnActive : ''}`}
                >
                    유저 업로드 검토
                    {pendingUploads.length > 0 && <span className={styles.tabBadge}>{pendingUploads.length}</span>}
                </button>
            </div>

            {success && <div className={styles.successMessage}>{success}</div>}

            {activeTab === 'review' ? (
                <div className={styles.reviewGrid}>
                    {pendingUploads.length === 0 ? (
                        <div className={styles.reviewEmpty}>대기 중인 업로드가 없습니다.</div>
                    ) : (
                        pendingUploads.map(item => (
                            <div key={item.id} className={styles.reviewCard}>
                                <div className={styles.reviewThumb}>
                                    <img src={item.thumbnailUrl || item.imageUrl} className={styles.reviewThumbImg} />
                                    <div className={styles.reviewBadge}>PENDING</div>
                                </div>
                                <div className={styles.reviewDate}>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</div>
                                <div className={styles.reviewName}>{item.songName}</div>
                                <button
                                    onClick={() => handleSelectTemp(item)}
                                    className={styles.reviewBtn}
                                >
                                    <FaPen size={12} /> 검토 및 등록
                                </button>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className={`${styles.panel} glass-panel`}>
                    {/* Form Content */}
                    <form onSubmit={handleSubmit} className={styles.form}>
                        {/* Show indicator if promoting */}
                        {promotingTempId && (
                            <div className={styles.promotionBanner}>
                                <span>🚀 임시 악보 승인 중 (저장 시 자동 변환됨)</span>
                                <button type="button" onClick={() => { setPromotingTempId(null); setFormData({ ...formData, songName: "" }); setUploadedImage(null); }} className={styles.promotionDismiss}><FaTimes /></button>
                            </div>
                        )}
                        {/* ... Existing Form Fields ... */}
                        <div className={styles.field}>
                            {/* ... */}
                            <div className={styles.fieldHeader}>
                                <label className={styles.label}>곡 제목</label>
                                {status && (
                                    <span className={`${styles.statusIndicator} ${status.className}`}>
                                        {status.label}
                                    </span>
                                )}
                            </div>
                            <input name="songName" required value={formData.songName} onChange={handleChange} className={styles.input} placeholder="예: 은혜 아니면" />
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>Key</label>
                                <select name="songKey" value={formData.songKey} onChange={handleChange} className={styles.input}>
                                    {["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>언어</label>
                                <select name="songLanguage" value={(formData as any).songLanguage} onChange={handleChange} className={styles.input}>
                                    <option value="한국어">한국어</option>
                                    <option value="영어">영어</option>
                                    <option value="아랍어">아랍어</option>
                                    <option value="터키어">터키어</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <div className={styles.labelRow}>
                                    <label className={styles.label}>카테고리</label>
                                    <button type="button" onClick={() => setShowHelp(true)} className={styles.helpBtn} title="카테고리 설명 보기">
                                        <FaQuestionCircle />
                                    </button>
                                </div>
                                <select name="songCategory" value={formData.songCategory} onChange={handleChange} className={styles.input}>
                                    <option value="상향">상향</option>
                                    <option value="외향">외향</option>
                                    <option value="내향">내향</option>
                                    <option value="JOY">JOY</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>BPM (템포)</label>
                            <input
                                type="number"
                                name="songBpm"
                                value={formData.songBpm}
                                onChange={handleChange}
                                className={styles.input}
                                placeholder="예: 72"
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>아티스트</label>
                            <input name="songArtist" value={formData.songArtist} onChange={handleChange} className={styles.input} placeholder="예: 어노인팅" />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>편곡자</label>
                            <input name="songArrangedBy" value={formData.songArrangedBy} onChange={handleChange} className={styles.input} placeholder="선택사항" />
                        </div>

                        <div className={styles.field}>
                            <div className={styles.uploadHeader}>
                                <label className={styles.label}>악보 이미지 (여러 장 가능)</label>
                                {uploadedImage && uploadedImage.length > 0 && (
                                    <button
                                        type="button"
                                        className={styles.clearBtn}
                                        onClick={async () => {
                                            if (confirm("업로드된 모든 이미지를 삭제하시겠습니까?")) {
                                                await cleanupUploadedImages(uploadedImage);
                                                setUploadedImage(null);
                                            }
                                        }}
                                    >
                                        전체 삭제
                                    </button>
                                )}
                            </div>
                            <div className={styles.uploadArea}>
                                <div className={styles.uploadInner}>
                                    {uploadedImage && Array.isArray(uploadedImage) && uploadedImage.length > 0 && (
                                        <div className={styles.imageGrid}>
                                            {uploadedImage.map((img: any, idx: number) => (
                                                <div key={idx} className={styles.imageCard}>
                                                    <img src={img.thumbnailUrl || img.url} className={styles.imageCardImg} />
                                                    <div className={styles.imagePageLabel}>
                                                        Page {idx + 1}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newImages = uploadedImage.filter((_: any, i: number) => i !== idx);
                                                            setUploadedImage(newImages.length ? newImages : null);
                                                        }}
                                                        className={styles.imageRemoveBtn}
                                                    >
                                                        <FaTimes size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className={styles.uploadDropRow}>
                                        {publicKey && urlEndpoint ? (
                                            <IKContext
                                                publicKey={publicKey}
                                                urlEndpoint={urlEndpoint}
                                                authenticator={authenticator}
                                            >
                                                <div className={styles.uploadDropZone}>
                                                    <IKUpload
                                                        fileName="music-sheet"
                                                        onError={onError}
                                                        onSuccess={onSuccess}
                                                        onUploadStart={() => setUploading(true)}
                                                        validateFile={(file: any) => file.size < 10000000} // 10MB
                                                        className={styles.uploadFileInput}
                                                        id="file-upload"
                                                    />
                                                    <label htmlFor="file-upload" className={styles.uploadLabel}>
                                                        <span className={styles.uploadIcon}>📄</span>
                                                        <span className={styles.uploadHint}>
                                                            {uploading ? "업로드 중..." : "클릭하여 이미지 추가"}
                                                        </span>
                                                    </label>
                                                </div>
                                            </IKContext>
                                        ) : (
                                            <div className={styles.imagekitError}>ImageKit 설정이 필요합니다</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={uploading || status?.conflict}
                            className={styles.submitBtn}
                        >
                            {uploading ? "업로드 중..." : (status?.conflict ? "충돌 해결 필요" : "저장하기")}
                        </button>
                    </form>
                </div>
            )}
            {showHelp && (
                <div className={styles.modalOverlay} onClick={() => setShowHelp(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.closeBtn} onClick={() => setShowHelp(false)}>
                            <FaTimes />
                        </button>
                        <img src="/category_explanation.png" alt="Category Explanation" className={styles.helpImage} />
                    </div>
                </div>
            )}
        </div>
    );
}
