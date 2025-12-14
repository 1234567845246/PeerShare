import { createI18n } from "vue-i18n";


export const i18n = createI18n({
    locale:'zh',
    fallbackLocale:'zh',
    legacy: false,
    messages:{
        zh:{
            nav: {
                navBtn1:'主页',
                navBtn2:'发送文件',
                navBtn3:'接收文件',
                navBtn4:'设置',
                themeToggle:'主题切换'
            }
        },
        en:{
            nav: {
                navBtn1:'Home',
                navBtn2:'Send File',
                navBtn3:'Receive File',
                navBtn4:'Setting',
                themeToggle:'Theme Toggle'
            }
        }
    }
})