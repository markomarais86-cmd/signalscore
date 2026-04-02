import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
		fontFamily: {
			sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
			heading: ['Geist', '"DM Sans"', 'system-ui', 'sans-serif'],
			mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
		},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				'executive-green': 'hsl(var(--executive-green))',
				'executive-amber': 'hsl(var(--executive-amber))',
				'executive-red': 'hsl(var(--executive-red))',
				'executive-navy': 'hsl(var(--executive-navy))',
				'executive-cyan': 'hsl(var(--executive-cyan))',
				'fit-high': 'hsl(var(--fit-high))',
				'fit-high-foreground': 'hsl(var(--fit-high-foreground))',
				'fit-medium': 'hsl(var(--fit-medium))',
				'fit-medium-foreground': 'hsl(var(--fit-medium-foreground))',
				'fit-low': 'hsl(var(--fit-low))',
				'fit-low-foreground': 'hsl(var(--fit-low-foreground))',
				'signal-high': 'hsl(var(--signal-high))',
				'signal-medium': 'hsl(var(--signal-medium))',
				'signal-low': 'hsl(var(--signal-low))',
				'status-success': 'hsl(var(--status-success))',
				'status-warning': 'hsl(var(--status-warning))',
				'status-danger': 'hsl(var(--status-danger))',
				'status-info': 'hsl(var(--status-info))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			boxShadow: {
				'glow': '0 0 40px -10px hsl(161 85% 60% / 0.4)',
				'glow-sm': '0 0 20px -5px hsl(161 85% 60% / 0.3)',
				'glow-lg': '0 0 60px -15px hsl(161 85% 60% / 0.5)',
				'executive': '0 4px 24px -4px hsl(0 0% 0% / 0.15)',
				'card-hover': '0 12px 40px -12px hsl(161 85% 60% / 0.2), 0 4px 16px -4px hsl(0 0% 0% / 0.1)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'50%': { transform: 'translateY(-20px) rotate(2deg)' }
				},
				'float-gentle': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'glow-pulse': {
					'0%, 100%': { 
						opacity: '0.3',
						boxShadow: '0 0 40px -10px hsl(161 85% 60% / 0.4)'
					},
					'50%': { 
						opacity: '0.5',
						boxShadow: '0 0 60px -10px hsl(161 85% 60% / 0.6)'
					}
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					'0%': { opacity: '0', transform: 'scale(0.95)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				},
				'slide-up': {
					'0%': { opacity: '0', transform: 'translateY(40px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-down': {
					'0%': { opacity: '0', transform: 'translateY(-40px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-left': {
					'0%': { opacity: '0', transform: 'translateX(40px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'slide-right': {
					'0%': { opacity: '0', transform: 'translateX(-40px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'blur-in': {
					'0%': { opacity: '0', filter: 'blur(10px)' },
					'100%': { opacity: '1', filter: 'blur(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'float': 'float 6s ease-in-out infinite',
				'float-delayed': 'float 6s ease-in-out 2s infinite',
				'float-gentle': 'float-gentle 4s ease-in-out infinite',
				'float-gentle-delayed': 'float-gentle 4s ease-in-out 1.5s infinite',
				'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
				'fade-in': 'fade-in 0.5s ease-out forwards',
				'scale-in': 'scale-in 0.3s ease-out forwards',
				'slide-up': 'slide-up 0.6s ease-out forwards',
				'slide-down': 'slide-down 0.6s ease-out forwards',
				'slide-left': 'slide-left 0.6s ease-out forwards',
				'slide-right': 'slide-right 0.6s ease-out forwards',
				'blur-in': 'blur-in 0.5s ease-out forwards'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
