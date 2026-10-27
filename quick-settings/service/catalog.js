(function (root) {
  'use strict';
  // Shared allowlist and navigation. Only user-facing scalar settings belong here.
  // Calibration arrays, pairing, scans and destructive actions stay in LG's UI.
  const settings = [];
  const pages = [];
  function page(section, title, target, category, entries) {
    const id = section + '/' + title;
    pages.push({id, section, title, target});
    for (const [key, label, quick = false] of entries) {
      settings.push({id:category+'.'+key, category, key, label, section, page:id, quick});
    }
  }
  page('Image','Mode et format','picture','picture',[
    ['pictureMode','Mode Image',true],['aspectRatio','Format de l’image',true],
    ['filmMakerMode','FILMMAKER MODE automatique'],['eyeComfortMode','Réduction de la lumière bleue']
  ]);
  page('Image','Luminosité','Brightness','picture',[
    ['backlight','Luminosité des pixels OLED',true],['contrast','Contraste',true],
    ['brightness','Niveau de noir'],['dynamicContrast','Contraste dynamique'],
    ['peakBrightness','Luminosité maximale'],['gamma','Gamma'],
    ['motionEyeCare','Protection des yeux selon le mouvement']
  ]);
  page('Image','Couleur','Color','picture',[
    ['color','Profondeur des couleurs'],['tint','Teinte'],['colorGamut','Gamme de couleurs'],
    ['dynamicColor','Couleur dynamique'],['colorTemperature','Température de couleur']
  ]);
  page('Image','Clarté','Clarity','picture',[
    ['sharpness','Netteté'],['superResolution','Super résolution'],['noiseReduction','Réduction du bruit'],
    ['mpegNoiseReduction','Réduction du bruit MPEG'],['smoothGradation','Dégradés fluides'],
    ['realCinema','Cinéma véritable'],
    ['truMotionJudder','TruMotion · saccades'],['truMotionBlur','TruMotion · flou'],['motionPro','OLED Motion']
  ]);
  page('Son','Mode et sortie','SoundOut','sound',[
    ['soundMode','Mode Son',true],['soundOutput','Sortie son',true],
    ['soundOutputDigital','Sortie audio numérique',true],['eArcSupport','Prise en charge eARC'],
    ['lgSoundSync','LG Sound Sync']
  ]);
  page('Son','Réglages avancés','AdditionalSound','sound',[
    ['supportATMOS','Dolby Atmos'],['audioBalance','Balance'],['autoVolume','Volume automatique'],
    ['digitalAudioPriority','Format audio TV numérique'],['tvSetupConfiguration','Installation du téléviseur']
  ]);
  page('Son','Synchronisation audio et vidéo','AvSync','sound',[
    ['avSyncSpeaker','Délai des haut-parleurs TV'],['avSyncSpdif','Délai audio numérique'],
    ['avSyncBypass','Synchronisation AV · Bypass']
  ]);
  page('Son','Format audio HDMI','InputAudioFormat','sound',[
    ['inputAudioFormatHDMI1','Format audio HDMI 1'],['inputAudioFormatHDMI2','Format audio HDMI 2'],
    ['inputAudioFormatHDMI3','Format audio HDMI 3'],['inputAudioFormatHDMI4','Format audio HDMI 4']
  ]);
  page('Général','Économie d’énergie','EnergySaving','picture',[
    ['energySaving','Économie d’énergie',true],['energySavingAutoMin','Luminosité minimale automatique']
  ]);
  page('Général','Protection OLED','OledScreenSaver','picture',[
    ['screenShift','Déplacement de l’écran'],['logoLuminanceAdjust','Luminosité des logos']
  ]);
  page('Général','Veille et minuteries','Timer','time',[
    ['sleepTimer','Minuterie de veille',true],['automaticStandBy','Veille automatique'],
    ['noSignalAutoOff','Arrêt sans signal'],['autoOff2HourOnTimer','Arrêt après allumage programmé']
  ]);
  page('Général','Accueil et démarrage','HomeSettings','general',[
    ['homeAutoLaunch','Accueil au démarrage'],['homePromotion','Promotions de l’accueil'],
    ['screenSaverAd','Publicités de l’économiseur d’écran'],['noSignalScreenSaver','Économiseur sans signal']
  ]);
  page('Général','Options système','AdditionalGeneral','option',[
    ['quickStartMode','Démarrage rapide+'],['standByLight','Voyant de veille'],
    ['helpOnSettings','Aide sur les paramètres'],['hddEcoMode','Économie d’énergie du disque dur'],
    ['livePlus','Live Plus'],['thirdPartyCookie','Cookies tiers']
  ]);
  page('Général','Télécommande et pointeur','PointerOptions','option',[
    ['pointerSpeed','Vitesse du pointeur'],['pointerSize','Taille du pointeur']
  ]);
  page('Général','HDMI et appareils','ExternalDeviceSettings','other',[
    ['simplinkEnable','SIMPLINK (HDMI-CEC)'],['simplinkAutoPowerOn','Allumage automatique HDMI']
  ]);
  page('Général','Allumage depuis un mobile','MobileTVOn','network',[
    ['wolwowlOnOff','Allumage par Wi-Fi / réseau'],['bleAdvertisingOnOff','Allumage par Bluetooth']
  ]);
  page('Général','Accessibilité visuelle','accessibility','option',[
    ['highContrast','Contraste élevé'],['menuTransparency','Transparence des menus'],
    ['screenMagnification','Agrandissement de l’écran'],['focusEmphasis','Accentuation du focus']
  ]);
  page('Général','Guidage audio','AudioGuidance','option',[
    ['audioGuidance','Guidage audio'],['audioGuidanceVolume','Volume du guidage'],
    ['audioGuidanceSpeed','Vitesse du guidage'],['audioGuidancePitch','Tonalité du guidage']
  ]);
  page('Général','Accessibilité de la télécommande','RemoteSlowInput','option',[
    ['remoteSlowInput','Touches lentes'],['longPressInterval','Durée d’appui long'],['repeatInterval','Intervalle de répétition']
  ]);
  page('Général','Audiodescription','accessibility','sound',[
    ['audioDescription','Audiodescription'],['audioDescriptionVolume','Volume de l’audiodescription'],
    ['tvPowerSound','Son de mise sous tension']
  ]);
  page('Général','Sous-titres','Subtitles','caption',[
    ['captionEnable','Sous-titres'],['hardOfHearing','Sous-titres pour malentendants']
  ]);
  page('Général','Langues des sous-titres','Language','option',[
    ['subtitleLanguageFirst','Langue principale'],['subtitleLanguageSecond','Langue secondaire']
  ]);
  page('Général','Services interactifs TV','HbbTV','option',[
    ['hbbTV','HbbTV'],['hbbTvDeviceId','Identifiant du téléviseur HbbTV']
  ]);
  page('Assistance','Mises à jour','SoftwareUpdate','support',[
    ['automaticUpdate','Mises à jour automatiques']
  ]);
  const links = [
    ['Image','Balance des blancs','WhiteBalance'],['Image','Réglage fin des couleurs','ColorManagement'],
    ['Image','Zoom et position de l’image','AspectRatioSettings'],['Image','Mode TruMotion','Clarity'],
    ['Son','Associer un appareil Bluetooth','Bluetooth'],['Son','Haut-parleurs combinés','MultiSpeaker'],
    ['Son','Égaliseur et autres options','AdditionalSound'],['Son','Calibrage acoustique IA','MagicSpaceSound'],
    ['Général','Réseau Wi-Fi et Ethernet','network'],['Général','Appareils Bluetooth externes','ConnectBluetooth'],
    ['Général','HDMI Deep Colour','DeepColor'],['Général','Optimiseur de jeu','game'],
    ['Général','Services IA','AiService'],['Général','Chaînes : recherche et gestion','channel'],
    ['Général','Langue des menus et de l’audio','Language'],['Général','Pays et localisation','Location'],
    ['Général','Date, heure et fuseau horaire','DateTime'],['Général','Allumage programmé','TimerPowerOn'],
    ['Général','Arrêt programmé','TimerPowerOff'],['Général','Verrouillage et contrôle parental','parentalControls'],
    ['Général','Nettoyage des pixels','PixelCleaning'],['Général','Toutes les options d’accessibilité','accessibility'],
    ['Général','Réinitialisation et autres options système','System'],
    ['Assistance','Informations sur le téléviseur','TVInformation'],['Assistance','Diagnostic et assistance LG','support'],
    ['Assistance','Optimisation de la mémoire','MemoryOptimizer'],['Assistance','Confidentialité et conditions','PolicyNotice'],
    ['Assistance','Publicité et identifiant publicitaire','Advertising']
  ].map(([section,title,target])=>({section,title,target}));
  const targets = Object.fromEntries([...pages,...links].map(item=>[item.target,
    item.target === 'network' ? {id:'com.webos.app.firstuse-overlay',params:{target:'network'}} :
    item.target === 'game' ? {id:'com.webos.app.gameoptimizer',params:{}} :
    {id:'com.palm.app.settings',params:{target:item.target}}]));
  const manifest = {settings,pages,links,targets};
  if (typeof module !== 'undefined') module.exports = manifest;
  else root.settingsManifest = manifest;
})(typeof window === 'undefined' ? globalThis : window);
