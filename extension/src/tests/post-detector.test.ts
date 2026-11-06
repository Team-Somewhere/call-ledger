// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { extractPost, findPostArticles, isProcessed, markProcessed, PROCESSED_ATTR } from "../content/post-detector";

function article(html: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return wrap.firstElementChild as HTMLElement;
}

const postHtml = (id: string, text: string) => `
  <article data-testid="tweet">
    <a href="/trader_x/status/${id}">12m</a>
    <div data-testid="tweetText">${text}</div>
  </article>`;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("post detection", () => {
  it("detects a normal post and reads its text, author and URL", () => {
    const el = article(postHtml("1911", "Buy ETH on Base at $3,000"));
    const p = extractPost(el);
    expect(p).not.toBeNull();
    expect(p!.postId).toBe("1911");
    expect(p!.authorHandle).toBe("trader_x");
    expect(p!.postUrl).toBe("https://x.com/trader_x/status/1911");
    expect(p!.text).toContain("Buy ETH");
  });

  it("returns null for a post with no readable text (deleted or unavailable)", () => {
    const el = article(`<article data-testid="tweet"><a href="/x/status/5">x</a></article>`);
    expect(extractPost(el)).toBeNull();
  });

  it("finds post articles in a container, including after infinite scroll", () => {
    document.body.innerHTML = `<main>${postHtml("1", "a")}${postHtml("2", "b")}</main>`;
    expect(findPostArticles(document)).toHaveLength(2);
    // Simulate infinite scroll appending another batch.
    document.querySelector("main")!.insertAdjacentHTML("beforeend", postHtml("3", "c"));
    expect(findPostArticles(document)).toHaveLength(3);
  });

  it("falls back to any article with a status link when test ids are missing", () => {
    document.body.innerHTML = `<section><article><a href="/u/status/9">t</a><div data-testid="tweetText">hi</div></article></section>`;
    expect(findPostArticles(document)).toHaveLength(1);
  });

  it("processes each article only once (no duplicate buttons)", () => {
    const el = article(postHtml("7", "x"));
    expect(isProcessed(el)).toBe(false);
    markProcessed(el);
    expect(isProcessed(el)).toBe(true);
    expect(el.getAttribute(PROCESSED_ATTR)).toBe("1");
  });

  it("does not treat a non-status profile link as a post id", () => {
    const el = article(`<article><a href="/trader_x">profile</a><div data-testid="tweetText">hi</div></article>`);
    const p = extractPost(el);
    expect(p!.postId).toBeNull();
    expect(p!.postUrl).toBeNull();
  });
});
