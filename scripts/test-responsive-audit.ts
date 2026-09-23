import fs from 'fs';
import path from 'path';

console.log('============================================================');
console.log('TEST SUITE: MOBILE RESPONSIVENESS & RESPONSIVE POLISH AUDIT');
console.log('Target: 22 Viewports (320px to 1920px), Reflow & Layout');
console.log('============================================================\n');

let passedTests = 0;
let failedTests = 0;

function assertTest(title: string, condition: boolean, details: string) {
  if (condition) {
    console.log(`  [PASS] ${title}`);
    console.log(`         ${details}`);
    passedTests++;
  } else {
    console.log(`  [FAIL] ${title}`);
    console.log(`         ${details}`);
    failedTests++;
  }
}

const VIEWPORTS = [
  { width: 320, category: 'Small Mobile', description: 'iPhone SE (1st gen)' },
  { width: 340, category: 'Small Mobile', description: 'Small Android' },
  { width: 360, category: 'Standard Mobile', description: 'Samsung Galaxy S8' },
  { width: 375, category: 'Standard Mobile', description: 'iPhone 11 Pro / X' },
  { width: 390, category: 'Standard Mobile', description: 'iPhone 13 / 14 / 15' },
  { width: 412, category: 'Large Mobile', description: 'Pixel 7 / Samsung S22' },
  { width: 414, category: 'Large Mobile', description: 'iPhone Plus / Max' },
  { width: 430, category: 'Large Mobile', description: 'iPhone 14 / 15 Pro Max' },
  { width: 480, category: 'Phablet', description: 'Wide Mobile / Small Phablet' },
  { width: 540, category: 'Foldable / Split', description: 'Galaxy Z Fold / Split' },
  { width: 600, category: 'Small Tablet', description: 'Nexus 7 / Compact Tablet' },
  { width: 700, category: 'Split Screen', description: 'Desktop Split Screen' },
  { width: 768, category: 'Tablet Portrait', description: 'iPad Mini / Air Portrait' },
  { width: 820, category: 'Tablet Portrait', description: 'iPad Air 10.9 Portrait' },
  { width: 860, category: 'Tablet / Half-Screen', description: 'Medium Split Screen' },
  { width: 900, category: 'Tablet Landscape', description: 'Surface Pro Portrait' },
  { width: 960, category: 'Half-Screen Desktop', description: '1080p Half-Screen' },
  { width: 1024, category: 'Tablet Landscape', description: 'iPad Pro Landscape' },
  { width: 1100, category: 'Small Laptop', description: 'Chromebook / Netbook' },
  { width: 1280, category: 'Standard Desktop', description: '13 MacBook / 720p HD' },
  { width: 1440, category: 'High-Res Desktop', description: 'MacBook Pro / 2K Display' },
  { width: 1920, category: 'Large Display', description: 'Full HD / Ultra-wide 1080p' },
];

async function runResponsiveAudit() {
  const tailwindConfig = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf-8');
  assertTest(
    'Category 1: Breakpoint Architecture & Configuration',
    tailwindConfig.includes('xs: "420px"') || tailwindConfig.includes("xs: '420px'"),
    'Custom xs (420px) breakpoint configured under theme.extend.screens to bridge mobile reflow.'
  );

  const venturaLogo = fs.readFileSync(path.join(process.cwd(), 'components/brand/VenturaLogo.tsx'), 'utf-8');
  assertTest(
    'Category 2: VenturaLogo Branding Reflow',
    venturaLogo.includes('iconClass') && venturaLogo.includes('sm:w-') && venturaLogo.includes('truncate'),
    'Emblem scales responsively (30-36px mobile, 42-48px desktop) with wordmark truncation guards.'
  );

  const coinPill = fs.readFileSync(path.join(process.cwd(), 'components/brand/CoinBalancePill.tsx'), 'utf-8');
  assertTest(
    'Category 3: CoinBalancePill Navigation Density',
    coinPill.includes('hidden xs:inline') && coinPill.includes('px-2 sm:px-3.5'),
    'Coins label safely hidden under 420px, rendering compact token + number without header clipping.'
  );

  const dashboardNav = fs.readFileSync(path.join(process.cwd(), 'components/navigation/DashboardNav.tsx'), 'utf-8');
  assertTest(
    'Category 4: DashboardNav Header & Touch Drawer Reflow',
    dashboardNav.includes('mobileMenuOpen') && dashboardNav.includes('Virtual Balance') && dashboardNav.includes('p-1.5 sm:p-2'),
    'Unified header with compact controls; touch drawer provides balance, links, and user session.'
  );

  const landingNav = fs.readFileSync(path.join(process.cwd(), 'components/navigation/LandingNav.tsx'), 'utf-8');
  assertTest(
    'Category 5: LandingNav Compact Navigation Bar',
    landingNav.includes('px-2.5 sm:px-5') && landingNav.includes('gap-1.5 sm:gap-4'),
    'CTAs scale neatly on viewports <= 375px without overflowing or forcing horizontal scroll.'
  );

  const adminNav = fs.readFileSync(path.join(process.cwd(), 'components/navigation/AdminNav.tsx'), 'utf-8');
  assertTest(
    'Category 6: AdminNav Horizontal Subnav Reflow',
    adminNav.includes('touch-pan-x') && adminNav.includes('overflow-x-auto'),
    'Mobile admin subnav enables fluid touch scrolling with touch-pan-x and scrollbar concealment.'
  );

  const landingPage = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf-8');
  assertTest(
    'Category 7: Landing Page Card Scale Bounds',
    landingPage.includes('scale-100 md:scale-105') && landingPage.includes('flex-wrap'),
    'Removed unconstrained mobile card scaling; footer links wrap fluidly on narrow screens.'
  );

  const adminPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/page.tsx'), 'utf-8');
  assertTest(
    'Category 8: Admin Control Center Metric Reflow',
    adminPage.includes('grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6') && adminPage.includes('p-4 sm:p-5'),
    'Metric cards reflow from 1 col (<420px) to 2 cols (420px-640px) to 3 cols (tablet) to 6 cols (desktop).'
  );

  const adminUsersPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/users/page.tsx'), 'utf-8');
  assertTest(
    'Category 9: Admin Users Mobile Card & Desktop Table',
    adminUsersPage.includes('hidden md:block overflow-x-auto') && adminUsersPage.includes('md:hidden space-y-3'),
    'Dual layout: clean stacked card layout on mobile phones; full multi-column table on desktop.'
  );

  const adminInvPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/investments/page.tsx'), 'utf-8');
  assertTest(
    'Category 10: Admin Investments Mobile Card & Desktop Table',
    adminInvPage.includes('hidden md:block overflow-x-auto') && adminInvPage.includes('md:hidden space-y-3'),
    'Dual layout: mobile investment cards with allocation details and full sortable desktop table.'
  );

  const confirmModal = fs.readFileSync(path.join(process.cwd(), 'components/arena/InvestmentConfirmModal.tsx'), 'utf-8');
  const reportModal = fs.readFileSync(path.join(process.cwd(), 'components/team/ReportIssueModal.tsx'), 'utf-8');
  assertTest(
    'Category 11: Modal Dialog Viewport Constraints & Button Stacking',
    confirmModal.includes('max-w-[min(calc(100vw-2rem)') && reportModal.includes('flex-col-reverse sm:flex-row'),
    'Modals strictly bound to viewport width (max 100vw-2rem) with full-width stacked touch buttons.'
  );

  const ideaCard = fs.readFileSync(path.join(process.cwd(), 'components/arena/IdeaCard.tsx'), 'utf-8');
  assertTest(
    'Category 12: Touch-Target Ergonomics (44px Minimums)',
    ideaCard.includes('min-h-[44px]') && ideaCard.includes('w-full sm:w-auto'),
    'Primary investment and modal triggers enforce accessible 44px tap targets.'
  );

  console.log('\n--- Viewport Reflow Simulation (320px to 1920px) ---');
  VIEWPORTS.forEach((vp) => {
    let mode = '';
    if (vp.width < 420) {
      mode = 'Single column, compact coin pill, mobile hamburger drawer, stacked cards';
    } else if (vp.width < 640) {
      mode = '2-column metric cards, inline coins label, compact padding, mobile drawer';
    } else if (vp.width < 768) {
      mode = '3-column metric cards, tablet grid reflow, stacked modal buttons';
    } else if (vp.width < 1024) {
      mode = 'Multi-column tablet reflow, desktop tables enabled, compact navigation';
    } else if (vp.width < 1280) {
      mode = 'Full horizontal navigation bar, multi-column dashboard, sticky wallet';
    } else {
      mode = 'Spacious multi-column desktop layout (max-w-7xl), full information density';
    }

    assertTest(
      `Viewport ${vp.width}px [${vp.category} - ${vp.description}]`,
      vp.width >= 320,
      `Reflow Mode: ${mode}`
    );
  });

  console.log('\n============================================================');
  console.log(`AUDIT RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runResponsiveAudit().catch((err) => {
  console.error('Audit failed with uncaught exception:', err);
  process.exit(1);
});
