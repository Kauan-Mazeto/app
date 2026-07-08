import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

export const signToken = (u) =>
  jwt.sign({ sub: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

export async function requireAuth(req, res, next) {
  let token = req.cookies?.access_token;
  if (!token && req.headers.authorization?.startsWith("Bearer "))
    token = req.headers.authorization.slice(7);
  if (!token) return res.status(401).json({ detail: "Não autenticado" });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: p.sub } });
    if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
    req.user = user; next();
  } catch { res.status(401).json({ detail: "Token inválido" }); }
}

export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ detail: "Acesso negado" });
  next();
};

export async function audit(user, action, target = "", details = {}) {
  await prisma.auditLog.create({ data: {
    userId: user.id, userName: user.name, userRole: user.role,
    action, target, details: JSON.stringify(details),
  }});
}
