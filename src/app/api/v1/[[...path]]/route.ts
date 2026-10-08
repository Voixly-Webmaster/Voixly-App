import { botError, withBot } from "@/lib/bots";
import {
  botMe,
  createTask,
  getCustomer,
  getText,
  linkText,
  listCustomers,
  listInvoices,
  listTexts,
  listTickets,
  replyToText,
  replyToTicket,
  sendCustomerText,
  updateTask,
} from "@/lib/bot-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(req: Request, method: string, path: string[]) {
  const [a, b, c] = path;
  const n = path.length;

  if (method === "GET" && n === 1 && a === "me") {
    return withBot(req, null, (bot) => botMe(bot));
  }
  if (method === "GET" && n === 1 && a === "customers") {
    return withBot(req, "customers:read", () => listCustomers(req));
  }
  if (method === "GET" && n === 2 && a === "customers" && b) {
    return withBot(req, "customers:read", () => getCustomer(b));
  }
  if (method === "GET" && n === 3 && a === "customers" && b && c === "invoices") {
    return withBot(req, "billing:read", () => listInvoices(b));
  }
  if (method === "GET" && n === 1 && a === "texts") {
    return withBot(req, "texts:read", () => listTexts(req));
  }
  if (method === "POST" && n === 1 && a === "texts") {
    return withBot(req, "texts:reply", (bot) => sendCustomerText(bot, "", req));
  }
  if (method === "POST" && n === 3 && a === "customers" && b && c === "texts") {
    return withBot(req, "texts:reply", (bot) => sendCustomerText(bot, b, req));
  }
  if (method === "GET" && n === 2 && a === "texts" && b) {
    return withBot(req, "texts:read", () => getText(b));
  }
  if (method === "POST" && n === 3 && a === "texts" && b && c === "replies") {
    return withBot(req, "texts:reply", (bot) => replyToText(bot, b, req));
  }
  if (method === "POST" && n === 3 && a === "texts" && b && c === "link") {
    return withBot(req, "texts:reply", (bot) => linkText(bot, b, req));
  }
  if (method === "POST" && n === 1 && a === "tasks") {
    return withBot(req, "tasks:write", (bot) => createTask(bot, req));
  }
  if (method === "PATCH" && n === 2 && a === "tasks" && b) {
    return withBot(req, "tasks:write", (bot) => updateTask(bot, b, req));
  }
  if (method === "GET" && n === 1 && a === "tickets") {
    return withBot(req, "support:read", () => listTickets(req));
  }
  if (method === "POST" && n === 3 && a === "tickets" && b && c === "replies") {
    return withBot(req, "support:write", (bot) => replyToTicket(bot, b, req));
  }

  if (a === "me" || a === "customers" || a === "texts" || a === "tasks" || a === "tickets") {
    return botError(405, "That method is not allowed");
  }
  return botError(404, "That address was not found");
}

export function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then(({ path }) => dispatch(req, "GET", path ?? []));
}

export function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then(({ path }) => dispatch(req, "POST", path ?? []));
}

export function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then(({ path }) => dispatch(req, "PATCH", path ?? []));
}
