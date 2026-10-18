import { proxy } from 'valtio';

export type PricingCycle = 'annual' | 'monthly';

export const uiStore = proxy({
  mobileNavOpen: false,
  pricingCycle: 'annual' as PricingCycle,
  heroPlaying: false,
  demoModalOpen: false,
});

export const uiActions = {
  toggleMobileNav() {
    uiStore.mobileNavOpen = !uiStore.mobileNavOpen;
  },
  closeMobileNav() {
    uiStore.mobileNavOpen = false;
  },
  setPricingCycle(cycle: PricingCycle) {
    uiStore.pricingCycle = cycle;
  },
  setHeroPlaying(playing: boolean) {
    uiStore.heroPlaying = playing;
  },
  openDemoModal() {
    uiStore.demoModalOpen = true;
    uiStore.mobileNavOpen = false;
  },
  closeDemoModal() {
    uiStore.demoModalOpen = false;
  },
};
