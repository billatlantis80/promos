#!/usr/bin/env python3
"""Interroge directement le serveur DNS FAISANT AUTORITÉ (pas un cache résolveur).
Usage : dnsq.py <serveur> <nom> <type>   ex. dnsq.py ns111.ovh.net kazendra.com A
On résout d'abord l'adresse du serveur via le résolveur système (getaddrinfo),
puis on pose la question DNS en UDP nous-mêmes : on lit donc la zone d'OVH telle
qu'elle est MAINTENANT, sans TTL de cache intermédiaire.
"""
import random
import socket
import struct
import sys

TYPES = {"A": 1, "NS": 2, "CNAME": 5, "MX": 15, "TXT": 16, "AAAA": 28}
TYPES_REV = {v: k for k, v in TYPES.items()}


def encoder_nom(nom):
    out = b""
    for part in nom.rstrip(".").split("."):
        out += bytes([len(part)]) + part.encode()
    return out + b"\x00"


def lire_nom(msg, pos):
    parts = []
    saute = False
    fin = pos
    while True:
        ln = msg[pos]
        if ln & 0xC0 == 0xC0:
            if not saute:
                fin = pos + 2
                saute = True
            pos = struct.unpack("!H", msg[pos:pos + 2])[0] & 0x3FFF
            continue
        if ln == 0:
            pos += 1
            break
        pos += 1
        parts.append(msg[pos:pos + ln].decode("utf-8", "replace"))
        pos += ln
    return ".".join(parts), (fin if saute else pos)


def interroger(serveur, nom, typ):
    ident = random.randint(0, 65535)
    entete = struct.pack("!HHHHHH", ident, 0x0100, 1, 0, 0, 0)
    question = encoder_nom(nom) + struct.pack("!HH", TYPES[typ], 1)
    paquet = entete + question

    ip = socket.getaddrinfo(serveur, 53, socket.AF_INET, socket.SOCK_DGRAM)[0][4][0]
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(8)
    s.sendto(paquet, (ip, 53))
    data, _ = s.recvfrom(4096)
    s.close()

    if struct.unpack("!H", data[:2])[0] != ident:
        raise RuntimeError("réponse incohérente")
    flags, ancount = struct.unpack("!HH", data[2:6])[0], struct.unpack("!H", data[6:8])[0]
    rcode = flags & 0x000F
    pos = len(entete) + len(question)
    reponses = []
    for _ in range(ancount):
        nom_r, pos = lire_nom(data, pos)
        t, cls, ttl, rdlen = struct.unpack("!HHIH", data[pos:pos + 10])
        pos += 10
        val = data[pos:pos + rdlen]
        pos += rdlen
        if t == 1:
            reponses.append(f"A   {nom_r} -> {socket.inet_ntoa(val)}   (TTL {ttl})")
        elif t == 28:
            reponses.append(f"AAAA {nom_r} -> {socket.inet_ntop(socket.AF_INET6, val)}   (TTL {ttl})")
        elif t == 5:
            cible, _ = lire_nom(data, pos - rdlen)
            reponses.append(f"CNAME {nom_r} -> {cible}   (TTL {ttl})")
        elif t == 15:
            pref = struct.unpack("!H", val[:2])[0]
            cible, _ = lire_nom(data, pos - rdlen + 2)
            reponses.append(f"MX   {nom_r} -> {pref} {cible}   (TTL {ttl})")
        elif t == 16:
            reponses.append(f"TXT  {nom_r} -> {val[1:1 + val[0]].decode('utf-8', 'replace')}   (TTL {ttl})")
        else:
            reponses.append(f"type {t} {nom_r}   (TTL {ttl})")
    if rcode == 3:
        reponses.append("(NXDOMAIN : le nom n'existe pas dans cette zone)")
    if not reponses:
        reponses.append(f"(aucune réponse, rcode {rcode})")
    return f"--- {nom} / {typ}  via {serveur} ({ip}) ---\n" + "\n".join("  " + r for r in reponses)


if __name__ == "__main__":
    serveur, nom, typ = sys.argv[1], sys.argv[2], sys.argv[3]
    for t in typ.split(","):
        print(interroger(serveur, nom, t))
