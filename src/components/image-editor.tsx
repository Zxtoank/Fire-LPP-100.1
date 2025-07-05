
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ImagePlus, ZoomIn, ZoomOut, RefreshCw, Replace, Square, Circle, Heart, Download, FileText, Package, Star, Lightbulb, Crown } from 'lucide-react';
import { Spinner } from '@/components/spinner';
import jsPDF from 'jspdf';
import type { OnApproveData, OnApproveActions, OrderResponseBody } from "@paypal/paypal-js";
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SENSITIVITY = 0.001;

const PRINT_DPI_PREVIEW = 600;
const PRINT_WIDTH_IN = 4;
const PRINT_HEIGHT_IN = 6;
const PRINT_WIDTH_PX = PRINT_WIDTH_IN * PRINT_DPI_PREVIEW;
const PRINT_HEIGHT_PX = PRINT_HEIGHT_IN * PRINT_DPI_PREVIEW;


const drawHeart = (ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, height: number) => {
    ctx.save();
    ctx.beginPath();

    // This path is based on the user-provided SVG, scaled to the target dimensions.
    // It has been made symmetrical for a cleaner appearance.
    const svgW = 32;
    const svgH = 29.6;
    const scaleX = width / svgW;
    const scaleY = height / svgH;
    const offsetX = cx - width / 2;
    const offsetY = y;

    // Helper to transform SVG coordinates to canvas coordinates
    const t = (svgX: number, svgY: number) => ({
        x: svgX * scaleX + offsetX,
        y: svgY * scaleY + offsetY,
    });

    // Start at the bottom tip of the heart
    let p = t(16, 29.6);
    ctx.moveTo(p.x, p.y);

    // Left side curve up
    let p1 = t(4.2, 17.2);
    let p2 = t(0, 13.3);
    let p3 = t(0, 8.4);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    // Left top lobe
    p1 = t(0, 3.8);
    p2 = t(3.8, 0);
    p3 = t(8.4, 0);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    // Left dip to center
    p1 = t(11.8, 0);
    p2 = t(14.8, 2.1);
    p3 = t(16, 5.1);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    // Right dip from center (mirrored)
    p1 = t(17.2, 2.1);
    p2 = t(20.2, 0);
    p3 = t(23.6, 0);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    // Right top lobe (mirrored)
    p1 = t(28.2, 0);
    p2 = t(32, 3.8);
    p3 = t(32, 8.4);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    // Right side curve down to tip (mirrored)
    p1 = t(32, 13.3);
    p2 = t(27.8, 17.2);
    p3 = t(16, 29.6);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    
    ctx.closePath();
    ctx.restore();
};


const PayPalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.754 6.019c.174.96.832 1.665 2.12 1.665h2.985c2.254 0 3.332-1.127 2.87-3.483-.443-2.261-2.086-3.18-4.143-3.18H8.81c-.84 0-1.42.38-1.74 1.18-.32.799-.174 1.74.684 2.818M16.425 8.414h-3.126c-2.348 0-3.323 1.136-2.818 4.055.435 2.463 1.83 3.323 4.018 3.323h1.168c.81 0 1.25-.435 1.438-.96.188-.525.136-1.168-.273-1.898-.409-.73-.97-1.18-1.855-1.18h-1.25c-.56 0-.84-.237-.96-.693-.119-.454.08-.85.748-.85h3.483c.97 0 1.57-.454 1.76-1.25.19-.79-.17-1.57-.96-1.57h-.35zM21.909 8.23c-.273-2.12-1.637-3.483-3.82-3.483h-3.474c-2.057 0-3.422.92-3.82 3.125-.4 2.206.637 3.422 2.819 3.422h.909c-.492 2.91-2.319 3.864-4.646 3.864h-2.12c-2.057 0-3.125-.97-2.61-3.23.493-2.19 1.855-3.07 3.69-3.07H8.81c.525 0 .97-.136 1.25-.748.28-.612.33-1.42.055-2.218-.27-.75-1.11-1.17-2.12-1.17H4.39c-2.505 0-4.256 1.57-3.636 4.78.638 3.266 2.61 4.727 5.46 4.727h1.42c.493 2.18 2.057 3.368 4.383 3.368h2.32c3.21 0 4.89-1.8 5.688-5.053.8-3.25.05-5.35-2.78-5.35z"></path></svg>
);

const OvalIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <ellipse cx="12" cy="12" rx="6" ry="9" />
    </svg>
);

const SectionHeader = ({ icon, title }: { icon?: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-primary rounded-full" />
        {icon}
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
    </div>
)


export default function ImageEditor() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [pinchStart, setPinchStart] = useState({ dist: 0, scale: 1 });
  const [cropShape, setCropShape] = useState<'square' | 'circle' | 'heart' | 'oval'>('square');

  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [printScale, setPrintScale] = useState(0.2);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const getSourceRect = useCallback(() => {
    if (!image || !canvasRef.current) return { sx: 0, sy: 0, sw: 0, sh: 0 };
    
    const editorCanvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const editorW = editorCanvas.width / dpr;
    const editorH = editorCanvas.height / dpr;

    let cropAR = 1.0;
    if (cropShape === 'oval') {
        cropAR = 0.7; // Vertical oval
    }
    
    const editorAR = editorW / editorH;
    
    let sourceViewWidth, sourceViewHeight;
    if (editorAR > cropAR) {
      sourceViewHeight = editorH / scale;
      sourceViewWidth = sourceViewHeight * cropAR;
    } else {
      sourceViewWidth = editorW / scale;
      sourceViewHeight = sourceViewWidth / cropAR;
    }
    
    const sourceCenterX = image.width / 2 - offset.x / scale;
    const sourceCenterY = image.height / 2 - offset.y / scale;

    return {
      sx: sourceCenterX - sourceViewWidth / 2,
      sy: sourceCenterY - sourceViewHeight / 2,
      sw: sourceViewWidth,
      sh: sourceViewHeight,
    };
  }, [image, scale, offset, cropShape]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
    }
    
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w === 0 || h === 0) return;

    const centerX = w / 2;
    const centerY = h / 2;
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);

    const shapeSize = Math.min(w, h) * 0.9;
    const shapeX = (w - shapeSize) / 2;
    const shapeY = (h - shapeSize) / 2;
    
    ctx.beginPath();
    switch (cropShape) {
        case 'circle':
            ctx.arc(centerX, centerY, shapeSize / 2, 0, 2 * Math.PI);
            break;
        case 'heart':
             const heartYForDraw = centerY - shapeSize / 2;
             drawHeart(ctx, centerX, heartYForDraw, shapeSize, shapeSize);
            break;
        case 'oval':
            ctx.ellipse(centerX, centerY, (shapeSize/2) * 0.7, shapeSize/2, 0, 0, 2 * Math.PI);
            break;
        case 'square':
        default:
             ctx.rect(shapeX, shapeY, shapeSize, shapeSize);
            break;
    }
    ctx.closePath();
    ctx.clip();
    
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
    
    ctx.translate(centerX + offset.x, centerY + offset.y);
    ctx.scale(scale, scale);
    
    ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
    
    ctx.restore();
  }, [image, scale, offset, cropShape]);

  useEffect(() => {
    draw();
  }, [draw]);
  
  const drawPrintLayout = useCallback(() => {
    if (!showPrintLayout || !image) return;
    setIsGenerating(true);

    const drawSingleCroppedImage = (
      ctx: CanvasRenderingContext2D,
      printX: number,
      printY: number,
      printW: number,
      printH: number
    ) => {
      if (!image) return;
      
      ctx.save();
      ctx.translate(printX, printY);
      
      ctx.beginPath();
       switch (cropShape) {
        case 'circle':
          ctx.arc(printW / 2, printH / 2, Math.min(printW, printH) / 2, 0, 2 * Math.PI);
          break;
        case 'heart':
          drawHeart(ctx, printW / 2, 0, printW, printH);
          break;
        case 'oval':
          ctx.ellipse(printW / 2, printH / 2, printW / 2, printH / 2, 0, 0, 2 * Math.PI);
          break;
        case 'square':
        default:
          ctx.rect(0, 0, printW, printH);
          break;
      }
      ctx.closePath();
      ctx.clip();
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, printW, printH);
      
      const { sx, sy, sw, sh } = getSourceRect();
      const sourceAR = sw / sh;
      const destAR = printW / printH;

      let finalW = printW, finalH = printH, finalX = 0, finalY = 0;
      if (sourceAR > destAR) {
          finalH = printH;
          finalW = printH * sourceAR;
          finalX = (printW - finalW) / 2;
      } else {
          finalW = printW;
          finalH = printW / sourceAR;
          finalY = (printH - finalH) / 2;
      }
      
      if (sw > 0 && sh > 0) {
        ctx.drawImage(image, sx, sy, sw, sh, finalX, finalY, finalW, finalH);
      }
      
      ctx.restore();
    };

    const printCanvas = printCanvasRef.current;
    if (!printCanvas) return;
    const ctx = printCanvas.getContext('2d');
    if (!ctx) return;

    printCanvas.width = PRINT_WIDTH_PX;
    printCanvas.height = PRINT_HEIGHT_PX;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, printCanvas.width, printCanvas.height);

    let cropAspectRatio = 1.0;
    if (cropShape === 'oval') {
        cropAspectRatio = 0.7;
    }
    
    const margin = 20;
    let currentX = margin;
    let currentY = margin;
    let maxRowHeight = 0;

    for (let heightMm = 8; heightMm <= 35; heightMm++) {
      const heightPx = (heightMm / 25.4) * PRINT_DPI_PREVIEW;
      const widthPx = heightPx * cropAspectRatio;

      if (currentX + widthPx + margin > printCanvas.width) {
        currentY += maxRowHeight + margin;
        currentX = margin;
        maxRowHeight = 0;
      }

      if (currentY + heightPx > printCanvas.height) {
        break; 
      }

      drawSingleCroppedImage(ctx, currentX, currentY, widthPx, heightPx);

      currentX += widthPx + margin;
      if (heightPx > maxRowHeight) {
        maxRowHeight = heightPx;
      }
    }

    try {
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) throw new Error("Could not create preview canvas context");

        const previewWidth = 400;
        const previewHeight = 600;
        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
        
        previewCtx.drawImage(printCanvas, 0, 0, previewWidth, previewHeight);

        const dataUrl = previewCanvas.toDataURL('image/jpeg', 0.9);
        localStorage.setItem('printPreviewDataUrl', dataUrl);
    } catch(e) {
        console.error("Could not save print preview to local storage", e);
        toast({variant: 'destructive', title: 'Storage Error', description: 'Could not save print preview for checkout.'});
    }

    setIsGenerating(false);

  }, [showPrintLayout, image, cropShape, toast, getSourceRect]);

  useEffect(() => {
    if (showPrintLayout) {
        setTimeout(drawPrintLayout, 50);
    }
  }, [showPrintLayout, drawPrintLayout]);


  const resetCanvasState = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    const scaleX = canvasWidth / img.width;
    const scaleY = canvasHeight / img.height;
    const initialScale = Math.max(scaleX, scaleY);
    
    setScale(initialScale);
    setOffset({ x: 0, y: 0 });
    setShowPrintLayout(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast({ variant: "destructive", title: "Invalid File", description: "Please upload an image file." });
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          resetCanvasState(img);
          setIsLoading(false);
          toast({ title: "Success", description: "Image uploaded successfully." });
        };
        img.onerror = () => {
          setIsLoading(false);
          toast({ variant: "destructive", title: "Error", description: "Could not load the image." });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDragging) { setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); } };
  const handleMouseUpOrLeave = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => { e.preventDefault(); const newScale = scale - e.deltaY * ZOOM_SENSITIVITY; setScale(Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE))); };
  const getDistance = (touches: React.TouchList) => Math.sqrt(Math.pow(touches[1].clientX - touches[0].clientX, 2) + Math.pow(touches[1].clientY - touches[0].clientY, 2));
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => { if (e.touches.length === 1) { setIsDragging(true); setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y }); } else if (e.touches.length === 2) { setPinchStart({ dist: getDistance(e.touches), scale: scale }); } };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (e.touches.length === 1 && isDragging) { const touch = e.touches[0]; setOffset({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y }); } else if (e.touches.length === 2) { const newDist = getDistance(e.touches); const newScale = pinchStart.scale * (newDist / pinchStart.dist); setScale(Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE))); } };
  const handleTouchEnd = () => setIsDragging(false);
  const handleZoom = (direction: 'in' | 'out') => { const newScale = direction === 'in' ? scale * 1.2 : scale / 1.2; setScale(Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE))); };
  const handleReset = () => { if(image) { resetCanvasState(image); toast({ title: "Canvas Reset", description: "Image position and zoom have been reset." }); } };
  const handleGeneratePreview = () => setShowPrintLayout(true);
  const handlePrintZoom = (direction: 'in' | 'out') => { const newScale = direction === 'in' ? printScale * 1.2 : printScale / 1.2; setPrintScale(Math.max(0.05, Math.min(newScale, 2))); };

  const generateDownloadableCanvas = useCallback(async (dpi: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        if (!image) return reject(new Error("No image loaded"));
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return reject(new Error("Could not create canvas context"));

        tempCanvas.width = PRINT_WIDTH_IN * dpi;
        tempCanvas.height = PRINT_HEIGHT_IN * dpi;
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        const drawSingleImageForDownload = (ctx: CanvasRenderingContext2D, pX: number, pY: number, pW: number, pH: number) => {
            if (!image) return;
            
            ctx.save();
            ctx.translate(pX, pY);
            
            ctx.beginPath();
            switch (cropShape) {
                case 'circle': ctx.arc(pW / 2, pH / 2, Math.min(pW, pH) / 2, 0, 2 * Math.PI); break;
                case 'heart': drawHeart(ctx, pW/2, 0, pW, pH); break;
                case 'oval':
                    ctx.ellipse(pW/2, pH/2, pW / 2, pH / 2, 0, 0, 2 * Math.PI);
                    break;
                case 'square': default: ctx.rect(0, 0, pW, pH); break;
            }
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, pW, pH);

            const { sx, sy, sw, sh } = getSourceRect();
            const sourceAR = sw / sh;
            const destAR = pW / pH;
            let finalW = pW, finalH = pH, finalX = 0, finalY = 0;
            if (sourceAR > destAR) {
                finalH = pH;
                finalW = pH * sourceAR;
                finalX = (pW - finalW) / 2;
            } else {
                finalW = pW;
                finalH = pW / sourceAR;
                finalY = (pH - finalH) / 2;
            }
            
            if (sw > 0 && sh > 0) {
              ctx.drawImage(image, sx, sy, sw, sh, finalX, finalY, finalW, finalH);
            }
            ctx.restore();
        };

        let cropAspectRatio = 1.0;
        if (cropShape === 'oval') {
            cropAspectRatio = 0.7;
        }
        
        const margin = (20 / 600) * dpi;
        let currentX = margin;
        let currentY = margin;
        let maxRowHeight = 0;

        for (let heightMm = 8; heightMm <= 35; heightMm++) {
            const heightPx = (heightMm / 25.4) * dpi;
            const widthPx = heightPx * cropAspectRatio;
            if (currentX + widthPx + margin > tempCanvas.width) {
                currentY += maxRowHeight + margin;
                currentX = margin;
                maxRowHeight = 0;
            }
            if (currentY + heightPx > tempCanvas.height) break;
            drawSingleImageForDownload(tempCtx, currentX, currentY, widthPx, heightPx);
            currentX += widthPx + margin;
            if (heightPx > maxRowHeight) maxRowHeight = heightPx;
        }
        resolve(tempCanvas);
    });
  }, [image, cropShape, getSourceRect]);

  const handleDownloadPNG = useCallback(async (dpi: number) => {
    const type = `png${dpi}`;
    if (downloadingType) return;
    setDownloadingType(type);
    toast({ title: "Preparing Download", description: `Generating ${dpi} DPI PNG... Please wait.` });

    try {
        const canvas = await generateDownloadableCanvas(dpi);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `locket-photo-print-${dpi}dpi.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Success", description: "PNG download started." });
        } else {
            throw new Error('Canvas toBlob returned null');
        }
    } catch (error) {
        console.error("PNG Download Error:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to generate PNG file." });
    } finally {
        setDownloadingType(null);
    }
  }, [downloadingType, generateDownloadableCanvas, toast]);

  const handleDownloadPDF = useCallback(async (dpi: number) => {
    const type = `pdf${dpi}`;
    if (downloadingType) return;
    setDownloadingType(type);
    toast({ title: "Preparing Download", description: `Generating ${dpi} DPI PDF... Please wait.` });

    try {
        const canvas = await generateDownloadableCanvas(dpi);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4, 6] });
        pdf.addImage(imgData, 'PNG', 0, 0, 4, 6);
        pdf.save(`locket-photo-print-${dpi}dpi.pdf`);
        toast({ title: "Success", description: "PDF download started." });
    } catch (error) {
        console.error("PDF Download Error:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF file." });
    } finally {
        setDownloadingType(null);
    }
  }, [downloadingType, generateDownloadableCanvas, toast]);
  
  const createOrder = useCallback(async (amount: string, description: string, requiresShipping = false) => {
     try {
        if (!user) {
            toast({ variant: "destructive", title: "Please Log In", description: "You need to be logged in to make a purchase." });
            router.push('/login');
            throw new Error("User not logged in");
        }
        
        const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description, requiresShipping })
        });
        const orderData = await response.json();
        if (response.ok) {
            return orderData.id;
        }
        const errorMsg = orderData.error || 'Failed to create PayPal order.';
        toast({ variant: "destructive", title: "Error Creating Order", description: errorMsg });
        throw new Error(errorMsg);
    } catch (error) {
        if (error instanceof Error && !error.message.includes('User not logged in') && !error.message.includes('PayPal')) {
            const message = error instanceof Error ? error.message : "An unknown network error occurred";
            toast({ variant: "destructive", title: "Error", description: message });
        }
        throw error;
    }
  }, [user, toast, router]);

  const onApprove = useCallback(async (data: OnApproveData, actions: OnApproveActions, purchaseType: 'png' | 'pdf') => {
    if (!actions.order || !user) {
        toast({ variant: "destructive", title: "Error", description: "PayPal actions are not available or user not logged in." });
        throw new Error("PayPal actions not available or user not logged in");
    }
    try {
        const details: OrderResponseBody = await actions.order.capture();
        
        await addDoc(collection(db, "users", user.uid, "downloads"), {
            paypalOrderId: details.id,
            downloadedAt: serverTimestamp(),
            type: `${purchaseType}-1200dpi`,
        });

        toast({ title: "Payment Successful!", description: `Thank you, ${details.payer.name.given_name}. Your download will begin shortly.` });
        
        if (purchaseType === 'png') {
            await handleDownloadPNG(1200);
        } else {
            await handleDownloadPDF(1200);
        }
    } catch (error) {
        console.error("PayPal Capture Error:", error);
        const message = error instanceof Error ? error.message : "There was an issue processing your payment. Please try again."
        toast({ variant: "destructive", title: "Payment Error", description: message });
        throw error;
    }
  }, [user, toast, handleDownloadPNG, handleDownloadPDF]);

  const onCancel = useCallback(() => {
    toast({
      variant: "default",
      title: "Payment Cancelled",
      description: "You have cancelled the payment process.",
    });
  }, [toast]);

  const onError = useCallback((err: any) => {
    console.error("PayPal Error:", err);
    toast({ variant: "destructive", title: "PayPal Error", description: "An unexpected error occurred with PayPal. Please try again." });
  }, [toast]);
  
  const handleOrderPhysicalClick = useCallback(() => {
    if (!user) {
        toast({ variant: "destructive", title: "Please Log In", description: "You need to be logged in to order physical prints." });
        router.push("/login");
        return;
    }
    if (showPrintLayout) {
        router.push("/checkout");
    }
  }, [user, router, toast, showPrintLayout]);
  
  const handleFeatureClick = (featureName: string) => {
     toast({
      variant: "default",
      title: "Coming Soon!",
      description: `${featureName} functionality is not yet implemented.`,
    });
  }

  const PayPalPurchaseButtons = ({type}: {type: 'png' | 'pdf'}) => {
    const createDigitalOrder = useCallback(() => {
        return createOrder('4.99', `Locket Photo Print Pro Download (1200DPI ${type.toUpperCase()})`);
    }, [type]);

    const onDigitalApprove = useCallback((data: OnApproveData, actions: OnApproveActions) => {
        return onApprove(data, actions, type);
    }, [type, onApprove]);
    
    if(!isClient) return null;

    return (
        <PayPalButtons
            style={{ layout: "horizontal", height: 40, tagline: false, shape: 'pill' }}
            createOrder={createDigitalOrder}
            onApprove={onDigitalApprove}
            onCancel={onCancel}
            onError={onError}
            disabled={!!downloadingType || !user}
        />
    );
  }

  return (
    <Card className="w-full max-w-xl mx-auto shadow-xl bg-card border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary">Locket Photo Editor</CardTitle>
        <CardDescription>1. Upload and position your photo for the perfect print.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-square bg-white rounded-lg overflow-hidden touch-none border">
          {!image ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <ImagePlus className="w-16 h-16 text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-gray-700">Upload Your Photo</h3>
              <p className="text-gray-500 mb-4">Click below to select an image from your device.</p>
              <Button onClick={handleUploadClick} disabled={isLoading}>
                {isLoading ? <Spinner className="mr-2" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {isLoading ? 'Loading...' : 'Upload Image'}
              </Button>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
               {isLoading && (
                <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center">
                  <Spinner className="w-8 h-8" />
                </div>
              )}
            </>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
        </div>
        {image && !isLoading && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col items-center gap-2 border-b pb-4">
              <p className="text-sm font-medium text-muted-foreground">Crop Shape</p>
              <div className="flex flex-wrap gap-2 justify-center">
                 <Button variant={cropShape === 'square' ? 'secondary' : 'outline'} size="icon" className="text-primary" onClick={() => setCropShape('square')}> <Square /> </Button>
                 <Button variant={cropShape === 'circle' ? 'secondary' : 'outline'} size="icon" className="text-primary" onClick={() => setCropShape('circle')}> <Circle /> </Button>
                 <Button variant={cropShape === 'heart' ? 'secondary' : 'outline'} size="icon" className="text-primary" onClick={() => setCropShape('heart')}> <Heart /> </Button>
                 <Button variant={cropShape === 'oval' ? 'secondary' : 'outline'} size="icon" className="text-primary" onClick={() => setCropShape('oval')}> <OvalIcon className="w-6 h-6" /> </Button>
              </div>
            </div>
            <TooltipProvider>
                <div className="flex flex-wrap gap-2 justify-center">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="text-primary" onClick={() => handleZoom('in')}><ZoomIn /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Zoom In</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="text-primary" onClick={() => handleZoom('out')}><ZoomOut /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Zoom Out</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="text-primary" onClick={handleReset}><RefreshCw /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Reset</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="text-primary" onClick={handleUploadClick}><Replace /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Change Image</p></TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
      {image && !showPrintLayout && (
        <CardFooter className="flex-col gap-4 border-t pt-6">
            <CardDescription className="text-center text-muted-foreground">2. When you're happy with the crop, generate the print preview.</CardDescription>
            <Button size="lg" onClick={handleGeneratePreview}>
                <Download className="mr-2" />
                Generate Print Preview
            </Button>
        </CardFooter>
      )}
      
      {showPrintLayout && (
        <>
            <CardHeader className="border-t">
                <CardTitle className="text-2xl font-bold text-primary">Print Preview</CardTitle>
                <CardDescription>Your photos are laid out on a 4x6 inch sheet.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => handlePrintZoom('out')}><ZoomOut className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => handlePrintZoom('in')}><ZoomIn className="h-4 w-4"/></Button>
                    </div>
                </div>
                <div className="w-full h-96 overflow-auto bg-gray-200/50 rounded-lg border relative">
                    {isGenerating && (
                        <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center z-10">
                            <Spinner />
                            <p className="ml-2">Generating layout...</p>
                        </div>
                    )}
                    <canvas
                        ref={printCanvasRef}
                        style={{ transform: `scale(${printScale})`, transformOrigin: 'top left' }}
                    />
                </div>
            </CardContent>
             <CardContent className="pt-6 space-y-8">
              {isClient && (
                <>
                  {!PAYPAL_CLIENT_ID ? (
                      <p className="text-sm text-red-500 p-2 text-center">PayPal is not configured. Purchases are disabled.</p>
                  ) : (
                    <>
                      {/* Export Options Section */}
                      <div>
                          <SectionHeader title="Export Options" />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                              {/* 600DPI PNG */}
                              <Card className="p-4 flex flex-col justify-between">
                                  <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                          <FileText className="text-blue-500 w-5 h-5" />
                                          <div>
                                              <h4 className="font-semibold">600DPI PNG</h4>
                                              <p className="text-sm text-muted-foreground mt-1">High quality for home printing</p>
                                          </div>
                                      </div>
                                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPNG(600)} disabled={!!downloadingType}>
                                          {downloadingType === 'png600' ? <Spinner /> : <Download />}
                                      </Button>
                                  </div>
                              </Card>
                              {/* 600DPI PDF */}
                              <Card className="p-4 flex flex-col justify-between">
                                  <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                          <FileText className="text-blue-500 w-5 h-5" />
                                          <div>
                                              <h4 className="font-semibold">600DPI PDF</h4>
                                              <p className="text-sm text-muted-foreground mt-1">Perfect for professional printing</p>
                                          </div>
                                      </div>
                                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(600)} disabled={!!downloadingType}>
                                          {downloadingType === 'pdf600' ? <Spinner /> : <Download />}
                                      </Button>
                                  </div>
                              </Card>
                              {/* 1200DPI PNG */}
                              <Card className="p-4 border-yellow-200 border bg-yellow-50/50 relative space-y-3">
                                  <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                         <FileText className="text-yellow-500 w-5 h-5" />
                                          <div>
                                              <h4 className="font-semibold">1200DPI PNG</h4>
                                              <p className="text-sm text-muted-foreground mt-1">Ultra-high resolution</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold bg-yellow-200/70 text-yellow-900 px-2 py-0.5 rounded-full">$4.99</span>
                                        <Button variant="ghost" size="icon" onClick={() => toast({description: "Please use the PayPal button below to purchase."})}>
                                            <Download className="text-yellow-500"/>
                                        </Button>
                                      </div>
                                      <div className="absolute -top-3 -right-3 text-xs font-bold text-orange-900 w-7 h-7 flex items-center justify-center rounded-full border-2 border-white shadow-lg bg-gradient-to-tr from-yellow-400 to-orange-400">
                                          <Crown className="w-4 h-4" />
                                      </div>
                                  </div>
                                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <PayPalIcon /> One-time purchase via PayPal
                                  </p>
                                  <div className="pt-2">
                                      <PayPalPurchaseButtons type="png" />
                                  </div>
                              </Card>
                              {/* 1200DPI PDF */}
                              <Card className="p-4 border-yellow-200 border bg-yellow-50/50 relative space-y-3">
                                  <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                          <FileText className="text-yellow-500 w-5 h-5" />
                                          <div>
                                              <h4 className="font-semibold">1200DPI PDF</h4>
                                              <p className="text-sm text-muted-foreground mt-1">Professional print quality</p>
                                          </div>
                                      </div>
                                       <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold bg-yellow-200/70 text-yellow-900 px-2 py-0.5 rounded-full">$4.99</span>
                                        <Button variant="ghost" size="icon" onClick={() => toast({description: "Please use the PayPal button below to purchase."})}>
                                            <Download className="text-yellow-500"/>
                                        </Button>
                                      </div>
                                      <div className="absolute -top-3 -right-3 text-xs font-bold text-orange-900 w-7 h-7 flex items-center justify-center rounded-full border-2 border-white shadow-lg bg-gradient-to-tr from-yellow-400 to-orange-400">
                                          <Crown className="w-4 h-4" />
                                      </div>
                                  </div>
                                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <PayPalIcon /> One-time purchase via PayPal
                                  </p>
                                  <div className="pt-2">
                                      <PayPalPurchaseButtons type="pdf" />
                                  </div>
                              </Card>
                          </div>
                      </div>

                      {/* Physical Prints */}
                      <div className="pt-4">
                          <SectionHeader icon={<Package className="text-green-500" />} title="Physical Prints" />
                          <Card className="p-6 mt-4 border-green-200 border bg-green-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                              <div>
                                  <h4 className="font-semibold text-lg">Professional Photo Prints</h4>
                                  <p className="text-muted-foreground mt-1">Get your custom locket photos printed on high-quality photo paper and delivered to your door.</p>
                                  <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                                      <li>4" x 6" professional photo paper</li>
                                      <li>Dozens of custom-sized photos per print</li>
                                      <li>Delivered in 5-7 business days</li>
                                  </ul>
                              </div>
                              <div className="text-center md:text-right flex-shrink-0">
                                  <p className="text-3xl font-bold text-green-700">$7.99</p>
                                  <p className="text-sm text-muted-foreground">per print</p>
                                  <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white" size="lg" onClick={handleOrderPhysicalClick} disabled={!user}>
                                      <Package className="mr-2"/> Order Physical Prints
                                  </Button>
                              </div>
                          </Card>
                      </div>

                      {/* Upgrade to Premium */}
                       <div className="pt-4">
                          <SectionHeader icon={<Star className="text-purple-500" />} title="Upgrade to Premium" />
                          <Card className="p-6 mt-4 border-purple-200 border bg-purple-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                  <div className="bg-purple-100 p-3 rounded-full">
                                      <Star className="text-purple-500 w-8 h-8"/>
                                  </div>
                                  <div>
                                      <h4 className="font-semibold text-lg">Unlimited Downloads & More</h4>
                                      <p className="text-muted-foreground">Get access to exclusive features and discounts.</p>
                                  </div>
                              </div>
                              <div className="text-center md:text-right flex-shrink-0">
                                  <p className="text-3xl font-bold text-purple-700">$9.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                                  <Button className="mt-2 bg-violet-500 hover:bg-violet-600 text-white" size="lg" onClick={() => handleFeatureClick('Premium Plans')}>
                                      <Star className="mr-2"/> View Plans
                                  </Button>
                              </div>
                          </Card>
                      </div>

                      {/* Pro Tip */}
                       <div className="pt-4">
                          <SectionHeader icon={<Lightbulb className="text-blue-500" />} title="Pro Tip" />
                          <Card className="p-4 mt-4 bg-blue-50/50 border-blue-200 border flex items-start gap-4">
                              <Lightbulb className="text-blue-500 mt-1 flex-shrink-0"/>
                              <div>
                                  <p className="text-sm text-muted-foreground">For best results, use 600DPI for home printing and 1200DPI for professional printing services. PDF format is recommended for commercial printers.</p>
                              </div>
                          </Card>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
        </>
      )}
    </Card>
  );
}
