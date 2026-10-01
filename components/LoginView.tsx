'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeClosed, 
  ShieldWarning, 
  Sparkle, 
  Sun, 
  Moon, 
  Globe, 
  Question, 
  TelegramLogo, 
  Phone, 
  EnvelopeSimple, 
  Copy, 
  Check, 
  X 
} from '@phosphor-icons/react';
import { useT } from '@/hooks/useTranslation';
import { securityRateLimiter, formatSafeError } from '@/lib/security';

// High-Performance Responsive HTML5 Canvas with DPI Scaling & Theme Awareness
const LoginBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let width = 0;
    let height = 0;

    const resize = () => {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        animate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    class Embers {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.5 + 0.8;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * -0.4 - 0.15; // Upward drift
        this.opacity = Math.random() * 0.35 + 0.08;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.y < -10) {
          this.y = height + 10;
          this.x = Math.random() * width;
        }
        if (this.x < -10 || this.x > width + 10) {
          this.x = Math.random() * width;
        }
      }

      draw(isDark: boolean) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(239, 47, 56, ${this.opacity * 1.2})`
          : `rgba(239, 47, 56, ${this.opacity * 0.8})`;
        ctx.fill();
      }
    }

    const particleCount = Math.min(45, Math.floor((width * height) / 25000));
    const particles: Embers[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Embers());
    }

    const animate = () => {
      if (!isVisible) return;

      const isDark = document.documentElement.classList.contains('dark');
      ctx.clearRect(0, 0, width, height);

      // 1. Radial Backdrop Gradient
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        40,
        width / 2,
        height / 2,
        Math.max(width, height)
      );

      if (isDark) {
        grad.addColorStop(0, '#0E0E10');
        grad.addColorStop(0.6, '#0A0A0B');
        grad.addColorStop(1, '#050505');
      } else {
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.7, '#F8F8F9');
        grad.addColorStop(1, '#ECECEE');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Technical Grid
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(239, 47, 56, 0.012)';
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Floating Athletic Embers
      particles.forEach((p) => {
        p.update();
        p.draw(isDark);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export function LoginView() {
  const { login, state, setTheme, setLanguage } = useAppStore();
  const t = useT();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedTelegram, setCopiedTelegram] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Load persisted rememberMe preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('infinity_remember_login');
      if (saved !== null) {
        setRememberMe(saved === 'true');
      }
    } catch {
      // Ignore localStorage failures in incognito/restricted modes
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Rate Limiting (5 attempts per minute)
    if (securityRateLimiter.isRateLimited('login_attempts', 5, 60000)) {
      setError(t('login_error_rate_limited'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(identifier.trim(), password);
      setLoading(false);

      if (!result.success) {
        securityRateLimiter.recordAttempt('login_attempts');
        setError(formatSafeError(result.error || t('login_error_invalid')));
        // Auto-focus password for quick retry
        passwordInputRef.current?.focus();
        passwordInputRef.current?.select();
      } else {
        securityRateLimiter.reset('login_attempts');
        try {
          localStorage.setItem('infinity_remember_login', String(rememberMe));
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      setLoading(false);
      securityRateLimiter.recordAttempt('login_attempts');
      setError(formatSafeError(err));
    }
  };

  const handleCopy = (text: string, type: 'telegram' | 'phone') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'telegram') {
        setCopiedTelegram(true);
        setTimeout(() => setCopiedTelegram(false), 2000);
      } else {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      }
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden overflow-y-auto bg-[#0A0A0A] dark:bg-[#0A0A0A] select-none font-sans transition-colors duration-300">
      
      {/* 1. Dynamic Canvas Ambient Embers */}
      <LoginBackground />

      {/* 2. Soft Crimson Center Aura */}
      <div className="absolute w-[500px] h-[500px] bg-[#EF2F38]/[0.035] dark:bg-[#EF2F38]/[0.06] rounded-full filter blur-[140px] pointer-events-none top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />

      {/* 3. Top Quick Utility Bar (Language Selector & Theme Switcher) */}
      <header className="relative z-20 w-full max-w-4xl mx-auto flex items-center justify-between py-2 pt-[env(safe-area-inset-top)] shrink-0">
        {/* Left: Brand Badge */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#EF2F38] animate-pulse" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-600 dark:text-neutral-400 uppercase">
            {t('login_badge')}
          </span>
        </div>

        {/* Right: Language Pill & Theme Switcher */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center p-0.5 bg-white/70 dark:bg-[#141414]/80 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 rounded-[8px] text-[10px] font-mono font-bold shadow-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-[8px] transition-all cursor-pointer ${
                state.language === 'en'
                  ? 'bg-[#EF2F38] text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('kh')}
              className={`px-2 py-1 rounded-[8px] transition-all cursor-pointer ${
                state.language === 'kh'
                  ? 'bg-[#EF2F38] text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
              title="ភាសាខ្មែរ"
            >
              ខ្មែរ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`px-2 py-1 rounded-[8px] transition-all cursor-pointer ${
                state.language === 'zh'
                  ? 'bg-[#EF2F38] text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
              title="中文"
            >
              中文
            </button>
          </div>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            className="p-2 min-h-[34px] min-w-[34px] flex items-center justify-center bg-white/70 dark:bg-[#141414]/80 hover:bg-white dark:hover:bg-[#1E1E1E] backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 rounded-[8px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer shadow-xs"
          >
            {state.theme === 'dark' ? (
              <Sun size={15} weight="bold" className="text-amber-400" />
            ) : (
              <Moon size={15} weight="bold" className="text-neutral-700" />
            )}
          </button>
        </div>
      </header>

      {/* 4. Center Glassmorphic Login Card */}
      <main className="relative z-10 w-full flex items-center justify-center my-auto py-6 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm sm:max-w-md bg-white/85 dark:bg-[#121212]/90 backdrop-blur-2xl rounded-[8px] p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800/90 shadow-[0_16px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)] flex flex-col gap-5 sm:gap-6 transition-colors"
        >
          {/* Academy Brand Logo & Header */}
          <div className="text-center">
            <div className="mb-4 relative flex justify-center">
              <img
                src="/icons/logo.svg"
                alt="Infinity TKD Crest Logo"
                width={160}
                height={55}
                fetchPriority="high"
                className="mx-auto h-auto w-32 sm:w-36 object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105"
              />
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-widest text-neutral-900 dark:text-white uppercase leading-tight">
              {t('login_title')}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-[11px] sm:text-xs mt-1 font-mono tracking-wider uppercase">
              {t('login_subtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
            {/* Username / Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-identifier"
                className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400 font-bold font-mono"
              >
                {t('login_username_email')}
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none"
                />
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoComplete="username"
                  className="w-full pl-10 pr-9 py-2.5 min-h-[44px] bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:bg-white dark:focus:bg-[#141414] rounded-[8px] focus:border-[#EF2F38] focus:ring-2 focus:ring-[#EF2F38]/20 outline-none transition-all text-sm font-sans placeholder:text-neutral-400 dark:placeholder:text-neutral-600 shadow-inner"
                  placeholder={t('login_username_email')}
                />
                {identifier.length > 0 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIdentifier('')}
                    aria-label="Clear username"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400 font-bold font-mono"
                >
                  {t('login_password')}
                </label>
              </div>

              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none"
                />
                <input
                  id="login-password"
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 min-h-[44px] bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:bg-white dark:focus:bg-[#141414] rounded-[8px] focus:border-[#EF2F38] focus:ring-2 focus:ring-[#EF2F38]/20 outline-none transition-all text-sm font-sans placeholder:text-neutral-400 dark:placeholder:text-neutral-600 shadow-inner"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t('login_hide_pw') : t('login_show_pw')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition p-2 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                >
                  {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-[4px] accent-[#EF2F38] cursor-pointer"
                />
                <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
                  {t('login_remember_me')}
                </span>
              </label>
            </div>

            {/* Error Banner with Shake Animation */}
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[8px] p-3 text-left shadow-sm animate-[shake_0.4s_ease-in-out]">
                <div className="flex gap-2.5 items-start">
                  <ShieldWarning size={18} className="text-[#EF2F38] shrink-0 mt-0.5" weight="fill" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">
                      {t('login_alert_title')}
                    </span>
                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed break-words font-sans">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#EF2F38] hover:bg-[#d6242c] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-xs py-3.5 min-h-[48px] rounded-[8px] transition-all duration-200 mt-1 shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('login_btn_authenticating')}</span>
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" />
                  <span>{t('login_btn_sign_in')}</span>
                </>
              )}
            </button>
          </form>

          {/* Need Access / Forgot Credentials Helper Trigger */}
          <div className="text-center pt-2 border-t border-neutral-200/80 dark:border-neutral-850">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium cursor-pointer"
            >
              <Question size={14} />
              <span>{t('login_need_help')}</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* 5. Bottom Copyright & Safety Banner */}
      <footer className="relative z-20 text-center py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[10px] font-mono text-neutral-600 dark:text-neutral-400 uppercase tracking-widest shrink-0">
        {t('login_footer_copyright')}
      </footer>

      {/* 6. Academy Support & Credentials Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 rounded-[8px] p-6 shadow-2xl flex flex-col gap-4 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[8px] bg-[#EF2F38]/10 text-[#EF2F38] flex items-center justify-center">
                    <ShieldWarning size={18} weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider font-mono">{t('login_help_title')}</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{t('login_help_subtitle')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3 font-sans">
                <p>
                  {t('login_help_desc')}
                </p>

                <div className="space-y-2 pt-1 font-mono text-xs">
                  {/* Telegram Channel */}
                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-[8px]">
                    <a 
                      href="https://t.me/infinity_taekwondo" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 group cursor-pointer"
                    >
                      <TelegramLogo size={20} className="text-[#0088cc] group-hover:scale-110 transition-transform" weight="fill" />
                      <div>
                        <span className="text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold block">{t('login_help_telegram')}</span>
                        <span className="font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors">@infinity_taekwondo</span>
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy('@infinity_taekwondo', 'telegram')}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-[8px] bg-neutral-200 dark:bg-neutral-800 hover:bg-[#EF2F38] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {copiedTelegram ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedTelegram ? t('login_help_copied') : t('login_help_copy')}</span>
                    </button>
                  </div>

                  {/* Academy Hotline */}
                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-[8px]">
                    <a 
                      href="tel:012220124"
                      className="flex items-center gap-2.5 group cursor-pointer"
                    >
                      <Phone size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" weight="fill" />
                      <div>
                        <span className="text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold block">{t('login_help_phone')}</span>
                        <span className="font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors">012 220 124</span>
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy('012220124', 'phone')}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-[8px] bg-neutral-200 dark:bg-neutral-800 hover:bg-[#EF2F38] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {copiedPhone ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPhone ? t('login_help_copied') : t('login_help_copy')}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-[8px] text-[11px] leading-relaxed">
                  {t('login_help_hours')}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold uppercase tracking-wider rounded-[8px] transition-colors cursor-pointer shadow-sm"
                >
                  {t('login_help_close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded shake animation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
      `}} />
    </div>
  );
}
