/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Core layout classes that might be missed in template literals
    'max-w-lg', 'max-w-xl', 'max-w-xs', 'aspect-[4/3]',
    'bg-white/5', 'bg-white/10', 'bg-white/[0.07]',
    'border-white/20', 'border-white/30',
    'hover:border-white/30', 'hover:bg-white/10', 'hover:bg-white/[0.07]',
    'shadow-blue-500/25', 'bg-blue-500/10', 'border-blue-400',
    'scale-[1.02]', 'translate-y-0', '-translate-y-4', 'translate-y-4',
    // Controls positioning
    'top-6', 'bottom-6', 'left-6', 'right-6', 'left-1/2', '-translate-x-1/2',
    'inset-0', 'z-[9999]', 'z-[100]',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
