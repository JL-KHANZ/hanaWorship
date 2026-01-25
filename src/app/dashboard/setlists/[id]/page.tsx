"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import styles from "./viewer.module.css";
import { AnimatePresence, motion } from "framer-motion";
import { FaDownload, FaArrowLeft, FaPrint, FaPlay, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import jsPDF from "jspdf";

export default function SetlistViewerPage() {
    const { id } = useParams();
    const router = useRouter();
    // Flattened Slides State
    const [slides, setSlides] = useState<any[]>([]);

    // ... existing basic states
    const [setlist, setSetlist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Slideshow State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const toggleControls = () => setShowControls(prev => !prev);

    useEffect(() => {
        if (!id) return;
        const fetchSet = async () => {
            try {
                const docRef = doc(db, "setlists", id as string);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() };
                    setSetlist(data);

                    // Flatten songs into slides
                    const flattened: any[] = [];
                    (data as any).songs.forEach((song: any) => {
                        const pages = song.pages && song.pages.length > 0 ? song.pages : (song.imageUrl ? [song.imageUrl] : []);
                        pages.forEach((pageUrl: string, pIndex: number) => {
                            flattened.push({
                                ...song,
                                imageUrl: pageUrl, // Override with specific page URL
                                pageIndex: pIndex,
                                totalPages: pages.length,
                                uniqueId: `${song.songName}-${pIndex}`
                            });
                        });
                        // Allow songs with no images to have at least one slide? 
                        // Current logic: if no image, empty array. 
                        // If empty array, maybe we push a fallback slide?
                        if (pages.length === 0) {
                            flattened.push({ ...song, imageUrl: null, pageIndex: 0, totalPages: 1 });
                        }
                    });
                    setSlides(flattened);
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

    // Preload Images (using slides)
    useEffect(() => {
        if (!slides || slides.length === 0) return;
        slides.forEach((slide: any) => {
            if (slide.imageUrl) {
                const img = new Image();
                img.src = slide.imageUrl;
            }
        });
    }, [slides]);

    const generatePDF = async () => {
        if (!slides || slides.length === 0) return;
        setGeneratingPdf(true);

        try {
            const doc = new jsPDF();
            let pageAdded = false;

            for (const slide of slides) {
                if (!slide.imageUrl) continue;

                if (pageAdded) {
                    doc.addPage();
                }

                // Add Title
                // doc.setFontSize(16);
                // let title = `${slide.songName} (${slide.songKey})`;
                // if (slide.totalPages > 1) {
                //     title += ` - Page ${slide.pageIndex + 1}`;
                // }
                // doc.text(title, 10, 10);

                // Fetch Image
                try {
                    const response = await fetch(slide.imageUrl, { mode: 'cors' });
                    const blob = await response.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });

                    const imgProps = doc.getImageProperties(base64 as string);
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();

                    // Account for your top margin (y = 20)
                    const margin = 20;
                    const maxAvailableWidth = pageWidth;
                    const maxAvailableHeight = pageHeight - margin;

                    let finalWidth = maxAvailableWidth;
                    let finalHeight = (imgProps.height * maxAvailableWidth) / imgProps.width;

                    // If the calculated height is still too tall for the page, scale by height instead
                    if (finalHeight > maxAvailableHeight) {
                        finalHeight = maxAvailableHeight;
                        finalWidth = (imgProps.width * maxAvailableHeight) / imgProps.height;
                    }

                    // Center the image horizontally if it's scaled by height
                    const xOffset = (pageWidth - finalWidth) / 2;

                    doc.addImage(base64 as string, 'JPEG', xOffset, margin, finalWidth, finalHeight);
                    pageAdded = true;
                } catch (err) {
                    console.error("Failed to load image for PDF", err);
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

    const nextSlide = () => {
        if (slides && currentIndex < slides.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const prevSlide = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (loading) return <div className="p-8 text-center">콘티 불러오는 중...</div>;
    if (!setlist) return null;

    const currentSlide = slides[currentIndex];

    const handleContainerClick = () => {
        if (!isDragging) {
            toggleControls();
        }
    };

    return (
        <div className={styles.container} onClick={handleContainerClick}>
            {/* Top Bar (Overlay) */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.topBar}
                        onClick={(e) => e.stopPropagation()} // Prevent toggling when clicking toolbar
                    >
                        <div className={styles.topBarContent}>
                            <button onClick={() => router.back()} className={styles.closeBtn}>
                                <FaArrowLeft /> 뒤로가기
                            </button>
                        </div>

                        <div className={styles.topBarContent}>
                            <button onClick={generatePDF} disabled={generatingPdf} className={styles.actionBtn}>
                                {generatingPdf ? <span className="text-xs">다운로드 중...</span> : <FaDownload />}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content (Swipeable) */}
            <div className={styles.mainContent}>
                <AnimatePresence initial={false} custom={currentIndex}>
                    <motion.div
                        key={currentIndex}
                        // Ensure y is never part of the animation cycle
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            touchAction: 'pan-y' // CRITICAL: Allows vertical scrolling but lets Framer handle horizontal
                        }}
                        className={styles.slideContainer}
                        drag="x" // Restricts dragging to the horizontal axis
                        dragDirectionLock // Stops diagonal dragging from "bleeding" into the wrong axis
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={(e, { offset }) => {
                            setTimeout(() => setIsDragging(false), 10);
                            const swipe = offset.x;
                            if (swipe < -50) nextSlide();
                            else if (swipe > 50) prevSlide();
                        }}
                    >
                        {currentSlide?.imageUrl ? (
                            <img
                                src={currentSlide.imageUrl}
                                className={styles.image}
                                alt="Music Sheet"
                            />
                        ) : (
                            <div className={styles.fallback}>
                                <div className={styles.fallbackTitle}>{currentSlide?.songName}</div>
                                <div>이미지가 없습니다</div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows (Desktop) */}
                <AnimatePresence>
                    {showControls && currentIndex > 0 && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`${styles.navBtn} ${styles.prevBtn}`}
                            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                        >
                            <FaChevronLeft />
                        </motion.button>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {showControls && slides && currentIndex < slides.length - 1 && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`${styles.navBtn} ${styles.nextBtn}`}
                            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                        >
                            <FaChevronRight />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Info & Caption - Group them to toggle */}
            <AnimatePresence>
                {showControls && currentSlide && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        style={{ pointerEvents: 'none' }} // Let clicks pass through to container
                    >
                        <div className={styles.caption} style={{ paddingBottom: '4rem' }}>
                            <h2 className={styles.captionTitle}>
                                {currentSlide.totalPages > 1 && (
                                    <span className="text-sm bg-blue-500/80 px-2 py-0.5 rounded-full mr-2 align-middle">
                                        P{currentSlide.pageIndex + 1}
                                    </span>
                                )}
                                {currentSlide.songName}
                            </h2>
                            <p className={styles.captionSubtitle}>
                                {currentSlide.songKey} {currentSlide.songArtist}
                            </p>
                        </div>

                        <div className={styles.pageIndicator}>
                            <div className={styles.pill}>
                                {currentIndex + 1} / {slides.length} • {setlist.name}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
