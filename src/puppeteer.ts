import puppeteer from 'puppeteer';

type PuppeteerModule = typeof puppeteer;

let provider: PuppeteerModule = puppeteer;

export function getPuppeteer(): PuppeteerModule {
  return provider;
}

export function setPuppeteer(p: PuppeteerModule): void {
  provider = p;
}

export function resetPuppeteer(): void {
  provider = puppeteer;
}
