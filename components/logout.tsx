"use client";

import { Icon } from "@/components/icons";
import { deconnexion } from "@/lib/auth-actions";
import { oublierCetAppareil } from "@/lib/push-appareil";
import { Button } from "@/components/ui/button";

export function Logout() {
    return (

              <form
              action={() => {
                oublierCetAppareil();
                deconnexion();
          }}
          className="lg:hidden flex items-center gap-3 p-4 rounded-lg  shadow-[0_0_0_1px_var(--color-border)] text-text"
        >
 <Button variant="danger" className="flex-1  items-center justify-center gap-2">
    <span className="font-semibold">Se deconnecter</span>
            
  <Icon name="logout" />
 </Button>
       
           
        
        </form>
            )
}