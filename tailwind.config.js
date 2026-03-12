module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          500: "#4f6ef7",
          600: "#3a57e8",
          900: "#1a2560",
        },
        surface:            'var(--color-bg-surface)',
        header:             'var(--color-bg-header)',
        accent:             'var(--color-accent)',
        'accent-container': 'var(--color-accent-container)',
        'text-primary':     'var(--color-text-primary)',
        'text-secondary':   'var(--color-text-secondary)',
        'text-muted':       'var(--color-text-muted)',
        'theme-border':     'var(--color-border)',
      },
      borderRadius: {
        card: 'var(--card-radius)',
      },
    }
  },
  plugins: []
}
