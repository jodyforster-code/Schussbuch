# Wettkampf-Ergebnisse (4.6.1)

Vorbereitung; noch nicht produktiv freigeben.

1. Zugriff auf Supabase-Projekt kyoowohgsqufqqnuebja herstellen.
2. Bestehende Sessions-Spalten und sämtliche Storage-Policies prüfen. setup/match-results.sql im Schussbuch-Projekt ausführen, private Bucket-Konfiguration verifizieren; keine pauschalen bestehenden Policies dürfen fremde Dateien freigeben.
3. Mit zwei Testbenutzern prüfen: eigene PDFs hochladen/listen/herunterladen/löschen, fremde Pfade verweigert, Upload auf fremden oder Trainingseintrag verweigert. Tests über Storage API, keine direkten Object-Inserts.
4. Neuen Wettkampf mit PDF speichern; Teilfehler erneut versuchen; bestehende PDFs nachtragen/entfernen. Nach Nutzerwechsel keine alten Downloads anzeigen.
5. Jahresdokument mit/ohne Checkbox prüfen; Jahresgrenzen, Trainingsausschluss und mehrseitige Anhänge.
6. Erst danach Produktionsbranch aktualisieren.

Bedienung: Eintrag > Wettkampf > Ergebnis-PDFs auswählen > Speichern. Für bestehende Einträge: Buch > Bearbeiten > Ergebnis-PDFs > Hochladen. Mehrere PDFs je Wettkampf, je max. 10 MB. Ergebnisanhänge sind nicht Bestandteil des bisherigen JSON-Backups und können einzeln heruntergeladen werden. Beim Behördendokument Checkbox setzen, um alle PDFs der Wettkämpfe im ausgewählten Kalenderjahr hinzuzufügen. Maßgeblich ist das Wettkampfdatum. Ohne Haken bleibt die bisherige Ausgabe unverändert. Fehlende/defekte PDFs brechen die Ausgabe ab, statt still zu fehlen.

Lokal geprüft: JavaScript-Syntax; Jahres-/Typfilter; Reihenfolge; vollständige Originalseiten und Seitengrößen; PDF ohne Anhänge; ungültige/zu große Dateien; Lesefehler. Kein angemeldeter Live-Test: Supabase-Verbindung gewährt derzeit nur Zugriff auf CCD Standbuchung. Browserinstallation in Testumgebung fehlgeschlagen; kein iPhone-Browsertest.
