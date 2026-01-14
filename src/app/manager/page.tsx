"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./manager.module.css";
import { IKContext, IKUpload } from "imagekitio-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { FaQuestionCircle, FaTimes } from "react-icons/fa";

const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

export default function ManagerPage() {
    const { user, isManager, loading } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        songName: "",
        songKey: "C",
        songCategory: "상향",
        songArtist: "",
        songArrangedBy: "",
        songBpm: "",
        songLanguage: "한국어"
    });
    const [uploading, setUploading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [success, setSuccess] = useState("");
    const [uploadedImage, setUploadedImage] = useState<any>(null);
    const [existingMatches, setExistingMatches] = useState<any[]>([]);
    const [preCheckLoading, setPreCheckLoading] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (!isManager) {
                router.push("/dashboard");
            }
        }
    }, [user, isManager, loading, router]);

    // Identity Pre-check
    useEffect(() => {
        if (!formData.songName || formData.songName.trim().length < 2) {
            setExistingMatches([]);
            return;
        }

        const timer = setTimeout(async () => {
            setPreCheckLoading(true);
            try {
                const q = query(
                    collection(db, "music_sheets"),
                    where("songName", "==", formData.songName.trim())
                );
                const snap = await getDocs(q);
                const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setExistingMatches(matches);
            } catch (e) {
                console.error("Pre-check error", e);
            } finally {
                setPreCheckLoading(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [formData.songName]);

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
    if (loading || !isManager) return <div className="p-8 text-center text-white">권한 확인 중...</div>;

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
            // Store all pages and their corresponding fileIds
            const pages = uploadedImage.map((img: any) => img.url);
            const imageIds = uploadedImage.map((img: any) => img.fileId).filter(Boolean);

            if (exactMatchDoc) {
                // 3. Conflict Check (Same Song Identity found)
                const existingData = (exactMatchDoc as any).data();
                const newCategory = formData.songCategory;
                const newBpm = formData.songBpm;
                const newLanguage = formData.songLanguage;

                // Check Category Conflict
                // existingData.songCategory is likely an array e.g. ["상향"]
                // formData.songCategory is a string e.g. "상향"
                let categoryConflict = false;
                if (existingData.songCategory && Array.isArray(existingData.songCategory) && existingData.songCategory.length > 0) {
                    // Check if the new category is already in the existing array. 
                    // Simple logic: if the existing array doesn't include the new category, user might be trying to change it.
                    // IMPORTANT: User asked "if there is a different value... reject".
                    // If existing is ['A'], new is 'B', that is different. Conflict.
                    // If existing is ['A'], new is 'A', no conflict.
                    if (!existingData.songCategory.includes(newCategory)) {
                        categoryConflict = true;
                    }
                }

                // Check BPM Conflict
                let bpmConflict = false;
                if (existingData.songBpm && String(existingData.songBpm).trim() !== "" && newBpm && String(newBpm).trim() !== "") {
                    if (String(existingData.songBpm) !== String(newBpm)) {
                        bpmConflict = true;
                    }
                }

                // Check Language Conflict
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

                    // Cleanup ImageKit if rejected
                    await cleanupUploadedImages(uploadedImage);
                    setUploadedImage(null);
                    return;
                }

                // 4. Update Existing Song (No Conflict)
                const docRef = doc(db, "music_sheets", (exactMatchDoc as any).id);

                // Prepare update data. We merge new Category if it wasn't there (though logic above ensures it matches if present).
                // If existing category was empty, we add it.
                // We update image to the new one.
                const updateData: any = {
                    imageUrl: mainImage.url,
                    thumbnailUrl: mainImage.thumbnailUrl || mainImage.url,
                    filePath: mainImage.filePath,
                    pages: pages, // Add pages array
                    imageIds: imageIds, // Store fileIds for future deletion
                    updatedAt: serverTimestamp(),
                    updatedBy: user?.uid
                };

                // Update info fields if they were missing
                if (!existingData.songBpm && newBpm) updateData.songBpm = newBpm;
                if (!existingData.songLanguage && newLanguage) updateData.songLanguage = newLanguage;
                if ((!existingData.songCategory || existingData.songCategory.length === 0) && newCategory) {
                    updateData.songCategory = [newCategory];
                }

                await updateDoc(docRef, updateData);

                setSuccess("기존 악보가 성공적으로 업데이트되었습니다! (이미지 및 페이지 갱신됨)");
            } else {
                // 5. Create New Song (Different Key/Arranger or New Name/Artist)
                await addDoc(collection(db, "music_sheets"), {
                    ...formData,
                    songCategory: formData.songCategory.split(",").map(s => s.trim()),
                    imageUrl: mainImage.url,
                    thumbnailUrl: mainImage.thumbnailUrl || mainImage.url,
                    filePath: mainImage.filePath,
                    pages: pages, // Add pages array
                    imageIds: imageIds, // Store fileIds for future deletion
                    uploadedBy: user?.uid,
                    createdAt: serverTimestamp(),
                });
                setSuccess("새로운 악보가 성공적으로 등록되었습니다!");
            }

            // Cleanup form
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
            // Check conflicts
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
            <div className="flex justify-between items-center mb-6">
                <h1 className={`${styles.title} premium-gradient !mb-0`}>악보 등록하기</h1>
            </div>

            {success && <div className={styles.successMessage}>{success}</div>}

            <div className={`${styles.panel} glass-panel`}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <div className="flex justify-between items-end mb-1">
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
                        <div className="flex justify-between items-center mb-1">
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
                            <div className="flex flex-col gap-4 w-full">
                                {uploadedImage && Array.isArray(uploadedImage) && uploadedImage.length > 0 && (
                                    <div className="grid grid-cols-2 gap-4 w-full mb-4">
                                        {uploadedImage.map((img: any, idx: number) => (
                                            <div key={idx} className="relative group aspect-[3/4] bg-black/20 rounded-lg overflow-hidden border border-white/10">
                                                <img src={img.thumbnailUrl || img.url} className="w-full h-full object-cover" />
                                                <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
                                                    Page {idx + 1}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newImages = uploadedImage.filter((_: any, i: number) => i !== idx);
                                                        setUploadedImage(newImages.length ? newImages : null);
                                                    }}
                                                    className="absolute top-2 right-2 bg-red-500/80 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                >
                                                    <FaTimes size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-center w-full">
                                    {publicKey && urlEndpoint ? (
                                        <IKContext
                                            publicKey={publicKey}
                                            urlEndpoint={urlEndpoint}
                                            authenticator={authenticator}
                                        >
                                            <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/10 transition-colors cursor-pointer w-full">
                                                <IKUpload
                                                    fileName="music-sheet"
                                                    onError={onError}
                                                    onSuccess={onSuccess}
                                                    onUploadStart={() => setUploading(true)}
                                                    validateFile={(file: any) => file.size < 10000000} // 10MB
                                                    style={{ display: 'none' }}
                                                    id="file-upload"
                                                />
                                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                                    <span className="text-2xl">📄</span>
                                                    <span className="text-sm text-gray-400">
                                                        {uploading ? "업로드 중..." : "클릭하여 이미지 추가"}
                                                    </span>
                                                </label>
                                            </div>
                                        </IKContext>
                                    ) : (
                                        <div className="text-red-400">ImageKit 설정이 필요합니다</div>
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
