# שפת Berger BI

השפה החזותית והפונקציונלית של כל דמו ומוצר שאנחנו בונים. כל אחד בצוות יכול לערוך אותה.

**רוצים לראות?** פותחים את `reference.html` (או את הקישור ל-Artifact). בצד יש תוכן עניינים, ולמעלה כפתורי הורדה.

## מה יש כאן
| קובץ | מה זה |
|---|---|
| `skills/berger-bi-ui/SKILL.md` | הליבה הקצרה ש-Claude קורא. קל וזול בטוקנים |
| `skills/berger-bi-ui/docs/rules.md` | הכללים המלאים בעברית. Claude קורא אותם רק כשבונים מסך חדש או בודקים |
| `skills/berger-bi-ui/docs/charts.md` | איך מציירים כל גרף |
| `skills/berger-bi-ui/tokens.css` | צבעים, גדלים ורכיבים. מעתיקים לכל פרויקט |
| `skills/berger-bi-ui/bbi-charts.js` | ספריית הגרפים. קריאה אחת לכל גרף |
| `skills/berger-bi-ui/logo_palette.py` | מציע צבע לקוח מתוך הלוגו |
| `reference.html` | העמוד הוויזואלי. נבנה מ-`src/` עם `tools/build_reference.py` |
| `CHANGELOG.md` | שורה אחת לכל שינוי |

## התקנה
**claude.ai (כל הצוות, הכי פשוט):** בעל הארגון נכנס להגדרות הארגון, Plugins & skills, Add, Sync from GitHub, ובוחר את הריפו הזה. מסמנים Installed by default ו-Sync automatically. מאותו רגע כולם מקבלים את הסקיל, גם באתר וגם ב-Claude Code, וכל שינוי בריפו מתעדכן אצלם לבד.

**Claude Code בלבד (בלי הגדרות ארגון):**
```
claude plugin marketplace add bergerbi/berger-bi-ui
claude plugin install berger-bi-ui@berger-bi
```
את העדכון האוטומטי מפעילים ב-`/plugin`, בלשונית Marketplaces.

## איך משנים
כל אחד בצוות עם גישה לריפו משנה ישירות. אין צורך באישור.
1. מבקשים מ-Claude את השינוי, למשל "תוסיף לסקיל של Berger BI גרף פיזור".
2. Claude מעדכן את הקבצים, מעלה את `version` ב-`.claude-plugin/plugin.json`, מוסיף שורה ל-`CHANGELOG.md`, ומריץ `python -I tools/build_reference.py`.
3. Commit ו-push ל-main.

**כללי אצבע:**
- SKILL.md נשאר קצר. פירוט נכנס ל-`docs/`.
- לא מכניסים נתוני לקוח אמיתיים.
- שינוי גדול (למשל צבע, שלד או גודל פונט) כותבים ביומן עם הסבר של שורה אחת.
- טעות? כל גרסה שמורה ב-git, ואפשר לחזור אחורה.
