import { useEffect } from "react";

interface TrackingPixelsProps {
  metaPixelId?: string;
  googleAdsId?: string;
  linkedInPartnerId?: string;
  tiktokPixelId?: string;
}

/**
 * Injects ad platform tracking pixels into the page head.
 * IDs should come from org settings or environment config.
 */
export function TrackingPixels({
  metaPixelId,
  googleAdsId,
  linkedInPartnerId,
  tiktokPixelId,
}: TrackingPixelsProps) {
  useEffect(() => {
    const scripts: HTMLScriptElement[] = [];

    // Meta / Facebook Pixel
    if (metaPixelId) {
      const s = document.createElement("script");
      s.innerHTML = `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${metaPixelId}');fbq('track','PageView');
      `;
      document.head.appendChild(s);
      scripts.push(s);
    }

    // Google Ads / gtag
    if (googleAdsId) {
      const g = document.createElement("script");
      g.async = true;
      g.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`;
      document.head.appendChild(g);
      scripts.push(g);

      const g2 = document.createElement("script");
      g2.innerHTML = `
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
        gtag('js',new Date());gtag('config','${googleAdsId}');
      `;
      document.head.appendChild(g2);
      scripts.push(g2);
    }

    // LinkedIn Insight Tag
    if (linkedInPartnerId) {
      const l = document.createElement("script");
      l.innerHTML = `
        _linkedin_partner_id="${linkedInPartnerId}";
        window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
        window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        (function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};
        window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];
        var b=document.createElement("script");b.type="text/javascript";b.async=true;
        b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
        s.parentNode.insertBefore(b,s)})(window.lintrk);
      `;
      document.head.appendChild(l);
      scripts.push(l);
    }

    // TikTok Pixel
    if (tiktokPixelId) {
      const t = document.createElement("script");
      t.innerHTML = `
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
        ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";
        o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];
        a.parentNode.insertBefore(o,a)};
        ttq.load('${tiktokPixelId}');ttq.page();
        }(window,document,'ttq');
      `;
      document.head.appendChild(t);
      scripts.push(t);
    }

    return () => {
      scripts.forEach((s) => s.remove());
    };
  }, [metaPixelId, googleAdsId, linkedInPartnerId, tiktokPixelId]);

  return null;
}
